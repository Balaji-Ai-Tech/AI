import React, { useState } from 'react';
import { Bell, Check, Sun, Moon, PlusCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { LanguageSelector } from './LanguageSelector';

export const Header: React.FC = () => {
  const { currentRoute, setCurrentRoute, historyRecords, resolvedTheme, toggleTheme, t } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const pageTitle = currentRoute === 'dashboard' ? 'Dashboard'
    : currentRoute === 'history' ? 'Projects'
      : currentRoute === 'transformation/new' ? 'New Project'
        : currentRoute === 'analytics' ? 'Analytics'
          : currentRoute === 'settings' ? (window.location.pathname.endsWith('/integrations') ? 'AI Integrations' : 'Settings')
            : currentRoute === 'templates' ? 'Templates' : currentRoute === 'profile' ? 'Profile' : 'Workspace';

  return (
    <header className="h-16 shrink-0 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <img src="/brand/transformhub-logo.svg" alt="" className="h-7 w-7 shrink-0" /><h1 className="whitespace-nowrap text-sm font-semibold text-slate-200">
          TransformHub AI <span className="font-normal text-slate-500">› {t(pageTitle)}</span>
        </h1>
        <span className="text-slate-700 hidden sm:inline">|</span>
        <span className="text-xs text-slate-400 font-mono hidden xl:inline">
          {t('Single Source • Multi-Audience Pipeline')}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync Status Indicator */}
        <SyncStatusIndicator />

        <LanguageSelector />

        <button
          onClick={() => setCurrentRoute('transformation/new')}
          className="hidden md:inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:brightness-110"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>New Transformation</span>
        </button>

        {/* Quick Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title={t(`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`)}
          aria-label={t('Toggle Theme')}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {historyRecords.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-30">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  {t('Notifications')}
                </span>
                <span className="text-[11px] text-slate-500">
                  {historyRecords.length} {t('system events')}
                </span>
              </div>

              {historyRecords.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  {t('No active notifications or alerts.')}
                </div>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {historyRecords.slice(0, 3).map((rec) => (
                    <div key={rec.id} className="text-xs bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-medium mb-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Transformation Complete')}</span>
                      </div>
                      <p className="text-slate-300 truncate">{rec.title}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {rec.completedAt} &bull; {rec.outputTypes.length} {t('outputs generated')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
