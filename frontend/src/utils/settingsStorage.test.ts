import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings } from './settingsStorage.ts';

test('UI language persists independently from generated-content language', () => {
  const savedValues = new Map<string, string>();
  saveAppSettings(
    { setItem: (key, value) => { savedValues.set(key, value); } },
    {
      ...DEFAULT_APP_SETTINGS,
      general: { ...DEFAULT_APP_SETTINGS.general, language: 'Tamil' },
      transformationDefaults: {
        ...DEFAULT_APP_SETTINGS.transformationDefaults,
        defaultLanguage: 'Hindi',
      },
    },
  );

  const restored = loadAppSettings(savedValues.get('transformhub_settings') ?? null);
  assert.equal(restored.general.language, 'Tamil');
  assert.equal(restored.transformationDefaults.defaultLanguage, 'Hindi');
});

test('older partial settings retain defaults for missing sections', () => {
  const restored = loadAppSettings(JSON.stringify({
    general: { language: 'Telugu' },
  }));

  assert.equal(restored.general.language, 'Telugu');
  assert.equal(restored.general.theme, DEFAULT_APP_SETTINGS.general.theme);
  assert.equal(restored.transformationDefaults.defaultLanguage, 'English');
});
