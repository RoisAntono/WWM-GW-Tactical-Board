export type ShareStorageProvider = 'neon';

export function normalizeShareStorageProvider(value: string | undefined): ShareStorageProvider {
  if (value === 'neon') {
    return value;
  }

  return 'neon';
}
