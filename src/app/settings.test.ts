import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings } from './settings';

describe('settings normalization', () => {
  it('defaults Gemini key empty and OCR warning enabled', () => {
    expect(normalizeSettings()).toEqual(defaultSettings);
    expect(normalizeSettings().geminiApiKey).toBe('');
    expect(normalizeSettings().suppressOcrWarning).toBe(false);
  });

  it('keeps suppress OCR warning only when explicitly enabled', () => {
    expect(normalizeSettings({ suppressOcrWarning: true }).suppressOcrWarning).toBe(true);
    expect(normalizeSettings({ suppressOcrWarning: false }).suppressOcrWarning).toBe(false);
  });

  it('trims stored Gemini API key', () => {
    expect(normalizeSettings({ geminiApiKey: '  test-key  ' }).geminiApiKey).toBe('test-key');
  });
});
