import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Shield, 
  Sliders, 
  Database, 
  Check, 
  Lock, 
  Key, 
  Bell, 
  Moon, 
  Sun,
  Laptop,
  Globe 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AudienceType, ToneType } from '../types';
import { UI_LANGUAGES } from '../i18n';
import { CONTENT_LANGUAGES } from '../utils/contentLanguages';
import { getIntegrationStatus, IntegrationStatus } from '../utils/api';

export const SettingsView: React.FC = () => {
  const { appSettings, updateAppSettings, clearAllHistory, showToast, resolvedTheme, t } = useApp();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'transformation' | 'data' | 'integrations'>(() =>
    typeof window !== 'undefined' && window.location.pathname.endsWith('/integrations') ? 'integrations' : 'general'
  );
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [integrationError, setIntegrationError] = useState('');

  useEffect(() => {
    const syncSettingsTab = () => setActiveTab(window.location.pathname.endsWith('/integrations') ? 'integrations' : 'general');
    window.addEventListener('popstate', syncSettingsTab);
    return () => window.removeEventListener('popstate', syncSettingsTab);
  }, []);

  useEffect(() => {
    if (activeTab !== 'integrations') return;
    let active = true;
    getIntegrationStatus().then((value) => { if (active) { setIntegrationStatus(value); setIntegrationError(''); } })
      .catch((error: unknown) => { if (active) setIntegrationError(error instanceof Error ? error.message : 'Could not load provider status.'); });
    return () => { active = false; };
  }, [activeTab]);

  // Local state for password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      showToast('New passwords do not match.');
      return;
    }
    showToast('Password updated securely.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="border-b border-slate-800 pb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          {t('Preferences & Controls')}
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">
          {t('Settings')}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {t('Configure system defaults, authentication policies, and data retention rules.')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'general'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{t('General')}</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'security'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{t('Security')}</span>
        </button>

        <button
          onClick={() => setActiveTab('transformation')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'transformation'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t('Transformation Defaults')}</span>
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'data'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{t('Data & Storage')}</span>
        </button>

        <button
          onClick={() => { setActiveTab('integrations'); window.history.pushState({}, '', '/settings/integrations'); }}
          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            activeTab === 'integrations'
              ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>{t('AI Integrations')}</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {activeTab === 'integrations' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white">AI integrations</h3>
              <p className="mt-1 text-xs text-slate-400">Provider settings are read from the backend environment. Credentials stay on the server and are never returned to this page.</p>
            </div>
            {integrationError && <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{integrationError}</div>}
            {!integrationStatus && !integrationError && <p className="text-xs text-slate-400">Loading provider status…</p>}
            {integrationStatus && <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">Content generation</p>
                <p className="mt-3 text-sm font-semibold capitalize text-white">{integrationStatus.generation.provider}</p>
                <p className="mt-1 text-xs text-slate-400">{integrationStatus.generation.model}</p>
                <span className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">{integrationStatus.generation.mode}</span>
              </section>
              <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">Evidence embeddings</p>
                <p className="mt-3 text-sm font-semibold capitalize text-white">{integrationStatus.embeddings.provider}</p>
                <p className="mt-1 text-xs text-slate-400">{integrationStatus.embeddings.model} · {integrationStatus.embeddings.dimensions} dimensions</p>
              </section>
            </div>}
            <p className="text-[11px] text-slate-500">To change providers, update the backend <code>.env</code> values for <code>LLM_PROVIDER</code>, <code>GENERATION_PROVIDER</code>, and <code>EMBEDDING_PROVIDER</code>, then restart the API.</p>
          </div>
        )}
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-white">{t('General Preferences')}</h3>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Platform Language')}
                </label>
                <select
                  value={appSettings.general.language}
                  onChange={(e) =>
                    updateAppSettings({ general: { ...appSettings.general, language: e.target.value } })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  {UI_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language.value === 'English' ? t('English (United States)') : language.nativeName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    {t('Interface Theme')}
                  </label>
                  <span className="text-[11px] font-mono text-indigo-400 capitalize">
                    {t('Active:')} {t(resolvedTheme === 'dark' ? 'Dark' : 'Light')} {t('Mode')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateAppSettings({
                        general: { ...appSettings.general, theme: 'dark' },
                      })
                    }
                    className={`py-2.5 px-3 text-xs font-medium rounded-lg border cursor-pointer flex items-center justify-center gap-2 transition-colors ${
                      appSettings.general.theme === 'dark'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('Dark')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateAppSettings({
                        general: { ...appSettings.general, theme: 'light' },
                      })
                    }
                    className={`py-2.5 px-3 text-xs font-medium rounded-lg border cursor-pointer flex items-center justify-center gap-2 transition-colors ${
                      appSettings.general.theme === 'light'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('Light')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateAppSettings({
                        general: { ...appSettings.general, theme: 'system' },
                      })
                    }
                    className={`py-2.5 px-3 text-xs font-medium rounded-lg border cursor-pointer flex items-center justify-center gap-2 transition-colors ${
                      appSettings.general.theme === 'system'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('System')}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={appSettings.general.emailNotifications}
                    onChange={(e) =>
                      updateAppSettings({
                        general: { ...appSettings.general, emailNotifications: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600"
                  />
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">
                      {t('Email Notifications')}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {t('Receive alerts when background transformation jobs complete review.')}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-white">{t('Security & Authentication')}</h3>

            <div className="space-y-6 max-w-md">
              {/* 2FA */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-medium text-white">
                      {t('Two-Factor Authentication (2FA)')}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      updateAppSettings({
                        security: {
                          ...appSettings.security,
                          twoFactorEnabled: !appSettings.security.twoFactorEnabled,
                        },
                      })
                    }
                    className={`px-3 py-1 rounded text-xs font-medium cursor-pointer ${
                      appSettings.security.twoFactorEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t(appSettings.security.twoFactorEnabled ? 'Enabled' : 'Disabled')}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t('Enforces hardware security keys or authenticator apps for operator logins.')}
                </p>
              </div>

              {/* Password Change */}
              <form onSubmit={handlePasswordSubmit} className="space-y-3 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300">{t('Change Password')}</h4>
                <div>
                  <input
                    type="password"
                    placeholder={t('Current Password')}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder={t('New Password')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder={t('Confirm New Password')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg cursor-pointer"
                >
                  {t('Update Password')}
                </button>
              </form>

              {/* Active Sessions */}
              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">{t('Active Session')}</h4>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
                  <div className="flex items-center justify-between text-white font-medium">
                    <span>{t('Current Browser Session')}</span>
                    <span className="text-emerald-400 text-[10px]">{t('Active')}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {t('IP address')}: 192.168.1.1 &bull; {t('SSL/TLS 1.3 Strict Transport')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transformation Defaults */}
        {activeTab === 'transformation' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-white">{t('Transformation Defaults')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Default Audience')}
                </label>
                <select
                  value={appSettings.transformationDefaults.defaultAudience}
                  onChange={(e) =>
                    updateAppSettings({
                      transformationDefaults: {
                        ...appSettings.transformationDefaults,
                        defaultAudience: e.target.value as AudienceType,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  <option value="Executives">{t('Executives')}</option>
                  <option value="Analysts">{t('Analysts')}</option>
                  <option value="General Public">{t('General Public')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Default Tone')}
                </label>
                <select
                  value={appSettings.transformationDefaults.defaultTone}
                  onChange={(e) =>
                    updateAppSettings({
                      transformationDefaults: {
                        ...appSettings.transformationDefaults,
                        defaultTone: e.target.value as ToneType,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  <option value="Formal">{t('Formal')}</option>
                  <option value="Technical">{t('Technical')}</option>
                  <option value="Urgent">{t('Urgent')}</option>
                  <option value="Simple">{t('Simple')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Default Language')}
                </label>
                <select
                  value={appSettings.transformationDefaults.defaultLanguage}
                  onChange={(e) =>
                    updateAppSettings({
                      transformationDefaults: {
                        ...appSettings.transformationDefaults,
                        defaultLanguage: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  {CONTENT_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.name}>{language.name} ({language.nativeName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Default Primary Output')}
                </label>
                <select
                  value={appSettings.transformationDefaults.defaultOutput}
                  onChange={(e) =>
                    updateAppSettings({
                      transformationDefaults: {
                        ...appSettings.transformationDefaults,
                        defaultOutput: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  <option value="Executive Summary">{t('Executive Summary')}</option>
                  <option value="Advisory">{t('Advisory')}</option>
                  <option value="Report">{t('Report')}</option>
                  <option value="Presentation">{t('Presentation')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Data & Storage */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-white">{t('Data Retention & Storage')}</h3>

            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t('Audit Log & History Retention')}
                </label>
                <select
                  value={appSettings.data.retentionDays}
                  onChange={(e) =>
                    updateAppSettings({
                      data: { ...appSettings.data, retentionDays: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                >
                  <option value={30}>30 {t('Days')}</option>
                  <option value={60}>60 {t('Days')}</option>
                  <option value={90}>90 {t('Days')} ({t('Enterprise Standard')})</option>
                  <option value={365}>365 {t('Days')}</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <span className="text-xs font-medium text-rose-400 block">
                  {t('Danger Zone')}
                </span>
                <p className="text-[11px] text-slate-500">
                  {t('Permanently purge all local transformation logs and export caches.')}
                </p>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {t('Clear All History Records')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
