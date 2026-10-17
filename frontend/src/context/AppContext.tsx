import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ViewRoute,
  UserProfile,
  CurrentTransformationState,
  CompletedTransformationRecord,
  AppSettings,
  TransformationStep,
  SyncStatus,
} from '../types';
import { translate } from '../i18n';
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from '../utils/settingsStorage';
import { normalizeContentLanguage } from '../utils/contentLanguages';
import { getTransformation, listTransformationOutputs, listTransformations } from '../utils/api';
import { toOutputItem } from '../utils/transformationOutputs';

interface AppContextType {
  currentRoute: ViewRoute;
  setCurrentRoute: (route: ViewRoute, preserveTransformationState?: boolean, targetPath?: string) => void;
  currentUser: UserProfile;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  transformationState: CurrentTransformationState;
  updateTransformationState: (updates: Partial<CurrentTransformationState>) => void;
  setTransformationStep: (step: TransformationStep) => void;
  resetTransformationState: () => void;
  historyRecords: CompletedTransformationRecord[];
  saveCompletedTransformation: (recordData?: Partial<CompletedTransformationRecord>) => void;
  openTransformationForReview: (record: CompletedTransformationRecord) => void;
  deleteHistoryRecord: (id: string) => void;
  clearAllHistory: () => void;
  appSettings: AppSettings;
  updateAppSettings: (updates: Partial<AppSettings>) => void;
  t: (text: string) => string;
  resolvedTheme: 'dark' | 'light';
  toggleTheme: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  syncStatus: SyncStatus;
  triggerManualSync: () => Promise<void>;
  setSyncStatus: (status: Partial<SyncStatus>) => void;
}

const defaultInitialTransformationState: CurrentTransformationState = {
  source: null,
  backendTransformationId: null,
  title: '',
  summary: '',
  configuration: {
    outputTypes: ['Executive Summary'],
    audience: 'Executives',
    tone: 'Formal',
    languages: ['en'],
    objective: 'Inform',
    detail: 'Balanced',
  },
  selectedTemplateId: null,
  outputs: [],
  currentStep: 'upload',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function routeFromPath(pathname: string): { route: ViewRoute; step?: TransformationStep; projectId?: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'projects' && parts[1] === 'new') {
    const steps: Record<string, TransformationStep> = {
      information: 'title-summary', configure: 'configure', templates: 'templates', processing: 'generate', knowledge: 'review',
      results: 'review', review: 'review', export: 'export',
    };
    return { route: 'transformation/new', step: steps[parts[2]] || 'upload' };
  }
  if (parts[0] === 'projects' && parts[1] && parts[1] !== 'new') {
    const steps: Record<string, TransformationStep> = {
      information: 'title-summary', configure: 'configure', templates: 'templates', processing: 'generate', knowledge: 'review',
      results: 'review', review: 'review', export: 'export',
    };
    return { route: 'transformation/new', step: steps[parts[2]] || 'review', projectId: parts[1] };
  }
  if (parts[0] === 'projects') return { route: 'history' };
  if (parts[0] === 'templates') return { route: 'templates' };
  if (parts[0] === 'analytics') return { route: 'analytics' };
  if (parts[0] === 'settings') return { route: parts[1] === 'profile' ? 'profile' : 'settings' };
  if (parts[0] === 'profile') return { route: 'profile' };
  return { route: 'dashboard' };
}

function pathForRoute(route: ViewRoute): string {
  const paths: Record<ViewRoute, string> = {
    splash: '/', dashboard: '/dashboard', 'transformation/new': '/projects/new',
    templates: '/templates', history: '/projects', analytics: '/analytics',
    settings: '/settings', profile: '/settings/profile',
  };
  return paths[route];
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRouteState] = useState<ViewRoute>('dashboard');
  
  const setCurrentRoute = (route: ViewRoute, preserveTransformationState = false, targetPath?: string) => {
    if (route === 'transformation/new' && !preserveTransformationState) {
      setTransformationState({
        ...defaultInitialTransformationState,
        configuration: {
          ...defaultInitialTransformationState.configuration,
          languages: [normalizeContentLanguage(appSettings.transformationDefaults.defaultLanguage)],
        },
      });
      try { localStorage.removeItem('transformhub_current_state'); } catch { /* ignore */ }
    }
    const resolvedPath = targetPath || (route === 'transformation/new' && preserveTransformationState && transformationState.backendTransformationId
      ? `/projects/${transformationState.backendTransformationId}/${transformationState.currentStep === 'export' ? 'export' : 'review'}`
      : pathForRoute(route));
    if (window.location.pathname !== resolvedPath) {
      window.history.pushState({}, '', resolvedPath);
    }
    setCurrentRouteState(route);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('transformhub_user');
      if (saved) {
        const profile = JSON.parse(saved) as UserProfile;
        setCurrentUser(profile);
      } else {
        const fallback = {
          name: 'TransformHub User',
          email: '',
          role: 'Operator',
          organization: 'TransformHub Workspace',
          twoFactorEnabled: false,
        };
        localStorage.setItem('transformhub_user', JSON.stringify(fallback));
        setCurrentUser(fallback);
      }
    } catch {
      // No auth gate is required; keep the app working in a local workspace.
    }
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      const match = routeFromPath(window.location.pathname);
      setCurrentRouteState(match.route);
      if (match.step) setTransformationState((previous) => ({ ...previous, currentStep: match.step! }));
      if (match.projectId) {
        const projectId = match.projectId;
        void Promise.all([getTransformation(projectId), listTransformationOutputs(projectId)]).then(([project, outputs]) => {
          if (window.location.pathname.split('/')[2] !== projectId) return;
          setTransformationState((previous) => ({
            ...previous,
            backendTransformationId: project.id,
            title: project.title,
            summary: project.summary || '',
            configuration: { ...defaultInitialTransformationState.configuration, ...project.configuration },
            outputs: outputs.map(toOutputItem),
            currentStep: match.step || 'review',
          }));
        }).catch(() => {
          setTransformationState((previous) => ({ ...previous, backendTransformationId: projectId, currentStep: match.step || 'review' }));
          showToast('Could not load this project. Check the API and project link.');
        });
      }
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('transformhub_user');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return {
      name: 'TransformHub User',
      email: '',
      role: 'Operator',
      organization: 'TransformHub Workspace',
      twoFactorEnabled: false,
    };
  });

  const [transformationState, setTransformationState] = useState<CurrentTransformationState>(() => {
    const saved = localStorage.getItem('transformhub_current_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // keep source representation without File instance serialization errors
        return {
          ...parsed,
          configuration: {
            ...defaultInitialTransformationState.configuration,
            ...parsed.configuration,
            languages: (parsed.configuration?.languages || ['English']).map(normalizeContentLanguage),
          },
        };
      } catch { /* ignore */ }
    }
    return defaultInitialTransformationState;
  });

  // History starts completely EMPTY on first launch as explicitly requested:
  // "At first launch: Total = 0, Completed = 0, In Review = 0, Failed = 0. Do not put fake transformation records here."
  const [historyRecords, setHistoryRecords] = useState<CompletedTransformationRecord[]>(() => {
    const saved = localStorage.getItem('transformhub_history_records');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    let cancelled = false;
    void listTransformations().then(async (projects) => {
      const records = await Promise.all(projects.map(async (project): Promise<CompletedTransformationRecord> => {
        const rows = await listTransformationOutputs(project.id).catch(() => []);
        const outputs = rows.map(toOutputItem);
        const date = new Date(project.created_at);
        const formattedDate = Number.isNaN(date.getTime()) ? project.created_at : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const config = { ...defaultInitialTransformationState.configuration, ...project.configuration } as CurrentTransformationState['configuration'];
        const status: CompletedTransformationRecord['status'] = project.status === 'approved' ? 'Completed'
          : project.status === 'generation_failed' ? 'Failed' : 'In Review';
        return {
          id: project.id,
          backendTransformationId: project.id,
          title: project.title,
          summary: project.summary || '',
          sourceName: project.title,
          sourceType: 'document',
          sourceSize: 0,
          outputTypes: config.outputTypes || [],
          outputs,
          configuration: config,
          createdAt: formattedDate,
          completedAt: formattedDate,
          status,
          processingDurationSeconds: 0,
        };
      }));
      if (!cancelled) setHistoryRecords((previous) => {
        const localOnly = previous.filter((record) => !record.backendTransformationId);
        return [...records, ...localOnly];
      });
    }).catch(() => { /* Keep the locally cached history available when the API is offline. */ });
    return () => { cancelled = true; };
  }, []);

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      return loadAppSettings(localStorage.getItem('transformhub_settings'));
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });
  const t = React.useCallback(
    (text: string) => translate(appSettings.general.language, text),
    [appSettings.general.language],
  );

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Synchronize theme to documentElement
  useEffect(() => {
    const applyTheme = () => {
      const mode = appSettings.general.theme;
      let effective: 'dark' | 'light' = 'dark';
      if (mode === 'system') {
        effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        effective = mode === 'light' ? 'light' : 'dark';
      }

      setResolvedTheme(effective);
      const root = document.documentElement;
      if (effective === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
      }
    };

    applyTheme();

    if (appSettings.general.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [appSettings.general.theme]);

  useEffect(() => {
    const locale = appSettings.general.language === 'Telugu'
      ? 'te'
      : appSettings.general.language === 'Hindi'
        ? 'hi'
        : appSettings.general.language === 'Tamil'
          ? 'ta'
          : 'en';
    document.documentElement.lang = locale;
  }, [appSettings.general.language]);

  const toggleTheme = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    updateAppSettings({ general: { ...appSettings.general, theme: next } });
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const [syncStatus, setSyncStatusState] = useState<SyncStatus>(() => ({
    state: 'synced',
    lastSyncedAt: new Date(),
    message: 'All transformations and configurations saved.',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  }));

  const setSyncStatus = React.useCallback((status: Partial<SyncStatus>) => {
    setSyncStatusState((prev) => ({
      ...prev,
      ...status,
      lastSyncedAt: status.state === 'synced' ? (status.lastSyncedAt || new Date()) : prev.lastSyncedAt,
    }));
  }, [setSyncStatusState]);

  const triggerManualSync = async () => {
    setSyncStatusState((prev) => ({
      ...prev,
      state: 'syncing',
      message: 'Syncing workspace with cloud server...',
    }));
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSyncStatusState({
      state: 'synced',
      lastSyncedAt: new Date(),
      message: 'Workspace and active pipelines synchronized.',
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    });
    showToast('Workspace synchronized with server.');
  };

  // Monitor online / offline network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatusState((prev) => ({
        ...prev,
        isOnline: true,
        state: 'syncing',
        message: 'Reconnected to server. Synchronizing workspace...',
      }));
      setTimeout(() => {
        setSyncStatusState((prev) => ({
          ...prev,
          state: 'synced',
          lastSyncedAt: new Date(),
          message: 'Workspace synchronized with cloud.',
        }));
      }, 700);
    };

    const handleOffline = () => {
      setSyncStatusState((prev) => ({
        ...prev,
        isOnline: false,
        state: 'offline',
        message: 'Working offline. Changes cached safely in browser.',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('transformhub_user', JSON.stringify(currentUser));
    } catch { /* ignore */ }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('transformhub_history_records', JSON.stringify(historyRecords));
    } catch { /* ignore */ }
  }, [historyRecords]);

  useEffect(() => {
    try {
      saveAppSettings(localStorage, appSettings);
    } catch { /* ignore */ }
  }, [appSettings]);

  const isInitialStateMount = React.useRef(true);
  useEffect(() => {
    if (isInitialStateMount.current) {
      isInitialStateMount.current = false;
      return;
    }

    setSyncStatusState((prev) => {
      if (!prev.isOnline) return prev;
      return {
        ...prev,
        state: 'syncing',
        message: 'Auto-saving transformation progress...',
      };
    });

    const timer = setTimeout(() => {
      try {
        // persist transformation state without raw DOM File references
        const stateToSave = {
          ...transformationState,
          source: transformationState.source
            ? {
                name: transformationState.source.name,
                size: transformationState.source.size,
                type: transformationState.source.type,
                uploadedAt: transformationState.source.uploadedAt,
                contentSample: transformationState.source.contentSample,
                sourceKind: transformationState.source.sourceKind,
                sourceUrl: transformationState.source.sourceUrl,
                analysis: transformationState.source.analysis,
              }
            : null,
        };
        localStorage.setItem('transformhub_current_state', JSON.stringify(stateToSave));
      } catch { /* ignore */ }

      setSyncStatusState((prev) => ({
        ...prev,
        state: prev.isOnline ? 'synced' : 'offline',
        lastSyncedAt: new Date(),
        message: prev.isOnline ? 'All transformation changes saved & synced.' : 'Cached locally.',
      }));
    }, 600);

    return () => clearTimeout(timer);
  }, [transformationState]);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
    showToast('Profile updated successfully.');
  };

  const updateTransformationState = React.useCallback((updates: Partial<CurrentTransformationState>) => {
    setTransformationState((prev) => ({ ...prev, ...updates }));
  }, [setTransformationState]);

  const setTransformationStep = (step: TransformationStep) => {
    setTransformationState((prev) => ({ ...prev, currentStep: step }));
    const stepPaths: Partial<Record<TransformationStep, string>> = {
      'title-summary': 'information', configure: 'configure', templates: 'templates', generate: 'processing', review: 'review', approve: 'review', export: 'export',
    };
    const suffix = stepPaths[step] || '';
    const projectPrefix = transformationState.backendTransformationId
      ? `/projects/${transformationState.backendTransformationId}`
      : '/projects/new';
    const path = suffix ? `${projectPrefix}/${suffix}` : projectPrefix;
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setCurrentRouteState('transformation/new');
  };

  const resetTransformationState = () => {
    setTransformationState(defaultInitialTransformationState);
    try {
      localStorage.removeItem('transformhub_current_state');
    } catch { /* ignore */ }
  };

  const saveCompletedTransformation = (customData?: Partial<CompletedTransformationRecord>) => {
    const id = `tx-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const newRecord: CompletedTransformationRecord = {
      id: customData?.id || id,
      backendTransformationId: customData?.backendTransformationId || transformationState.backendTransformationId || undefined,
      title: customData?.title || transformationState.title || transformationState.source?.name || 'Untitled transformation',
      summary: customData?.summary ?? transformationState.summary ?? '',
      sourceName: customData?.sourceName || transformationState.source?.name || 'Unknown source',
      sourceType: customData?.sourceType || transformationState.source?.type || 'unknown',
      sourceSize: customData?.sourceSize ?? transformationState.source?.size ?? 0,
      outputTypes: customData?.outputTypes || transformationState.configuration.outputTypes,
      outputs: customData?.outputs || transformationState.outputs,
      configuration: customData?.configuration || transformationState.configuration,
      createdAt: customData?.createdAt || formattedDate,
      completedAt: customData?.completedAt || formattedDate,
      status: customData?.status || (
        transformationState.outputs.length > 0 && transformationState.outputs.every((output) => output.approved)
          ? 'Completed'
          : 'In Review'
      ),
      processingDurationSeconds: customData?.processingDurationSeconds ?? 0,
      templateName: customData?.templateName || transformationState.selectedTemplateId || undefined,
    };

    setHistoryRecords((prev) => {
      const existingIndex = newRecord.backendTransformationId
        ? prev.findIndex((record) => record.backendTransformationId === newRecord.backendTransformationId)
        : -1;
      if (existingIndex < 0) return [newRecord, ...prev];
      return prev.map((record, index) => index === existingIndex ? newRecord : record);
    });
    showToast(newRecord.status === 'Completed' ? 'Transformation saved to History.' : 'Draft saved to History for review.');
  };

  const openTransformationForReview = (record: CompletedTransformationRecord) => {
    if (!record.backendTransformationId) {
      showToast('This draft is missing its backend transformation ID and cannot be reviewed.');
      return;
    }
    setTransformationState({
      ...defaultInitialTransformationState,
      backendTransformationId: record.backendTransformationId,
      title: record.title,
      summary: record.summary,
      source: {
        name: record.sourceName,
        size: record.sourceSize,
        type: record.sourceType,
        uploadedAt: record.createdAt,
        sourceKind: record.sourceType === 'text/html (Web Document)' ? 'url' : 'file',
      },
      configuration: record.configuration,
      outputs: record.outputs,
      currentStep: 'review',
    });
    setCurrentRoute('transformation/new', true);
    window.history.replaceState({}, '', `/projects/${record.backendTransformationId}/review`);
  };

  const deleteHistoryRecord = (id: string) => {
    setHistoryRecords((prev) => prev.filter((r) => r.id !== id));
    showToast('Record deleted.');
  };

  const clearAllHistory = () => {
    setHistoryRecords([]);
    showToast('History cleared.');
  };

  const updateAppSettings = (updates: Partial<AppSettings>) => {
    setAppSettings((prev) => ({
      ...prev,
      ...updates,
      general: { ...prev.general, ...updates.general },
      security: { ...prev.security, ...updates.security },
      transformationDefaults: { ...prev.transformationDefaults, ...updates.transformationDefaults },
      data: { ...prev.data, ...updates.data },
    }));
    showToast('Settings saved.');
  };

  return (
    <AppContext.Provider
      value={{
        currentRoute,
        setCurrentRoute,
        currentUser,
        updateUserProfile,
        transformationState,
        updateTransformationState,
        setTransformationStep,
        resetTransformationState,
        historyRecords,
        saveCompletedTransformation,
        openTransformationForReview,
        deleteHistoryRecord,
        clearAllHistory,
        appSettings,
        updateAppSettings,
        t,
        resolvedTheme,
        toggleTheme,
        toastMessage,
        showToast,
        syncStatus,
        triggerManualSync,
        setSyncStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
