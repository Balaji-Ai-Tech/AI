import type { AppSettings } from '../types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  general: {
    language: 'English',
    theme: 'dark',
    emailNotifications: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60,
  },
  transformationDefaults: {
    defaultAudience: 'Executives',
    defaultTone: 'Formal',
    defaultLanguage: 'English',
    defaultOutput: 'Executive Summary',
  },
  data: {
    retentionDays: 90,
    allowTelemetry: false,
  },
};

export function loadAppSettings(
  serialized: string | null,
  defaults: AppSettings = DEFAULT_APP_SETTINGS,
): AppSettings {
  if (!serialized) return defaults;

  try {
    const saved = JSON.parse(serialized) as Partial<AppSettings>;
    return {
      ...defaults,
      ...saved,
      general: { ...defaults.general, ...saved.general },
      security: { ...defaults.security, ...saved.security },
      transformationDefaults: {
        ...defaults.transformationDefaults,
        ...saved.transformationDefaults,
      },
      data: { ...defaults.data, ...saved.data },
    };
  } catch {
    return defaults;
  }
}

export function saveAppSettings(
  storage: Pick<Storage, 'setItem'>,
  settings: AppSettings,
): void {
  storage.setItem('transformhub_settings', JSON.stringify(settings));
}
