export function parseStatNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatCompactNumber(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '-';
  }

  return new Intl.NumberFormat('en-US', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}
