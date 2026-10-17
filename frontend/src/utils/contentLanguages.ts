export const CONTENT_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
] as const;

export type ContentLanguageCode = (typeof CONTENT_LANGUAGES)[number]['code'];

const LANGUAGE_CODES_BY_VALUE = new Map(
  CONTENT_LANGUAGES.flatMap(({ code, name }) => [
    [code, code],
    [name.toLowerCase(), code],
  ]),
);

export function normalizeContentLanguage(value: string): string {
  return LANGUAGE_CODES_BY_VALUE.get(value.trim().toLowerCase()) ?? value;
}

export function toggleContentLanguage(selected: string[], code: string): string[] {
  const current = selected.map(normalizeContentLanguage);
  if (current.includes(code)) {
    return current.length > 1 ? current.filter((language) => language !== code) : current;
  }
  return [...current, code];
}
