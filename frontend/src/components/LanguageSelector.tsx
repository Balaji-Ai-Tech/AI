import React from 'react';
import { Languages } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UI_LANGUAGES } from '../i18n';

export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { appSettings, updateAppSettings, t } = useApp();

  return (
    <label className={`flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-slate-300 ${className}`} title={t('Platform Language')}>
      <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <select
        aria-label={t('Platform Language')}
        value={appSettings.general.language}
        onChange={(event) => updateAppSettings({
          general: { ...appSettings.general, language: event.target.value },
        })}
        className="max-w-24 bg-transparent py-1.5 text-xs outline-none"
      >
        {UI_LANGUAGES.map((language) => (
          <option key={language.value} value={language.value} className="bg-slate-900">
            {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
};
