export type AppSettings = {
  geminiApiKey: string;
  suppressOcrWarning: boolean;
};

export const defaultSettings: AppSettings = {
  geminiApiKey: '',
  suppressOcrWarning: false,
};

export function normalizeSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    geminiApiKey: typeof settings?.geminiApiKey === 'string' ? settings.geminiApiKey.trim() : defaultSettings.geminiApiKey,
    suppressOcrWarning:
      typeof settings?.suppressOcrWarning === 'boolean'
        ? settings.suppressOcrWarning
        : defaultSettings.suppressOcrWarning,
  };
}
