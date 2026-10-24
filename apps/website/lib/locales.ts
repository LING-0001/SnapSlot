export const locales = ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English", "zh-Hans": "简体中文", "zh-Hant": "繁體中文",
  ja: "日本語", ko: "한국어", es: "Español",
};
