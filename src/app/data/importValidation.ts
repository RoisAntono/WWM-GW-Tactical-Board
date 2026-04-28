import { createId } from '../../shared/id';
import type {
  ImportBatch,
  ImportBatchFile,
  ImportKind,
  ImportRow,
  ImportSource,
  MemberRank,
  MemberRole,
} from '../../types/domain';

const managedWarnings = new Set([
  'Missing IGN',
  'No match stats detected; review manually',
  'Low OCR confidence',
  'Low Gemini confidence',
]);

const numericImportFields = new Set<keyof ImportRow>([
  'attendance',
  'defeated',
  'deaths',
  'assist',
  'dpsAvg',
  'healAvg',
  'tankAvg',
  'siegeAvg',
  'coinAvg',
]);

export type ImportBatchInput = {
  source: ImportSource;
  kind: ImportKind;
  fileName?: string;
  rowCount: number;
  acceptedCount: number;
  warningCount: number;
  matchId?: string;
  model?: string;
  detectedMatchTime?: string;
  files?: ImportBatchFileInput[];
  id?: string;
  createdAt?: string;
};

export type ImportBatchFileInput = {
  id?: string;
  source?: ImportSource;
  fileName?: string;
  rowCount?: number;
  acceptedCount?: number;
  warningCount?: number;
  detectedMatchTime?: string;
  timestampOnly?: boolean;
  confidenceAvg?: number;
  error?: string;
};

export function validateImportRows(rows: ImportRow[], kind: ImportKind): ImportRow[] {
  return rows.map((row) => validateImportRow(row, kind));
}

export function validateImportRow(row: ImportRow, kind: ImportKind): ImportRow {
  const warnings = row.warnings.filter((warning) => !managedWarnings.has(warning));

  if (!row.ign.trim()) {
    warnings.push('Missing IGN');
  }
  if (kind === 'match' && !hasMatchStat(row)) {
    warnings.push('No match stats detected; review manually');
  }
  if (row.source === 'ocr' && row.confidence !== undefined && row.confidence < 70) {
    warnings.push('Low OCR confidence');
  }
  if (row.source === 'gemini' && row.confidence !== undefined && row.confidence < 65) {
    warnings.push('Low Gemini confidence');
  }

  return {
    ...row,
    ign: row.ign.trim(),
    warnings: Array.from(new Set(warnings)),
  };
}

export function getValidImportRows(rows: ImportRow[], kind: ImportKind): ImportRow[] {
  return validateImportRows(rows, kind).filter((row) => hasValidImportRow(row, kind));
}

export function hasValidImportRow(row: ImportRow, kind: ImportKind): boolean {
  return Boolean(row.ign.trim()) && (kind === 'member' || hasMatchStat(row));
}

export function updateImportRowField(row: ImportRow, key: keyof ImportRow, value: string, kind: ImportKind): ImportRow {
  let nextRow: ImportRow;

  if (key === 'memberRole') {
    nextRow = { ...row, memberRole: (value || undefined) as MemberRole | undefined };
  } else if (key === 'rank') {
    nextRow = { ...row, rank: (value || undefined) as MemberRank | undefined };
  } else if (numericImportFields.has(key)) {
    const trimmedValue = value.trim();
    const parsed = Number(trimmedValue);
    nextRow = { ...row, [key]: trimmedValue && Number.isFinite(parsed) ? parsed : undefined };
  } else {
    nextRow = { ...row, [key]: value } as ImportRow;
  }

  return validateImportRow(nextRow, kind);
}

export function createImportBatch(input: ImportBatchInput): ImportBatch {
  const files = createImportBatchFiles(input);

  return {
    id: input.id ?? createId('import-batch'),
    source: input.source,
    kind: input.kind,
    fileName: input.fileName?.trim() || undefined,
    createdAt: input.createdAt ?? new Date().toISOString(),
    rowCount: safeCount(input.rowCount),
    acceptedCount: safeCount(input.acceptedCount),
    warningCount: safeCount(input.warningCount),
    matchId: input.matchId,
    model: input.model?.trim() || undefined,
    detectedMatchTime: input.detectedMatchTime?.trim() || undefined,
    files: files.length ? files : undefined,
  };
}

export function countImportWarnings(rows: ImportRow[]): number {
  return rows.reduce((total, row) => total + row.warnings.length, 0);
}

function hasMatchStat(row: ImportRow): boolean {
  return [row.defeated, row.deaths, row.assist, row.dpsAvg, row.healAvg, row.tankAvg, row.siegeAvg, row.coinAvg].some(
    (value) => value !== undefined && Number.isFinite(value),
  );
}

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function createImportBatchFiles(input: ImportBatchInput): ImportBatchFile[] {
  const files = (input.files ?? [])
    .map((file) => createImportBatchFile(file, input.source))
    .filter((file): file is ImportBatchFile => Boolean(file));

  if (files.length || !input.fileName) {
    return files;
  }

  return [
    createImportBatchFile(
      {
        fileName: input.fileName,
        rowCount: input.rowCount,
        acceptedCount: input.acceptedCount,
        warningCount: input.warningCount,
        detectedMatchTime: input.detectedMatchTime,
      },
      input.source,
    ),
  ].filter((file): file is ImportBatchFile => Boolean(file));
}

function createImportBatchFile(input: ImportBatchFileInput, fallbackSource: ImportSource): ImportBatchFile | undefined {
  const fileName = input.fileName?.trim() || undefined;
  const detectedMatchTime = input.detectedMatchTime?.trim() || undefined;
  const error = input.error?.trim() || undefined;
  const hasMeaningfulData =
    fileName ||
    detectedMatchTime ||
    error ||
    input.timestampOnly ||
    input.rowCount !== undefined ||
    input.acceptedCount !== undefined ||
    input.warningCount !== undefined ||
    input.confidenceAvg !== undefined;

  if (!hasMeaningfulData) {
    return undefined;
  }

  return {
    id: input.id?.trim() || createId('import-file'),
    source: input.source ?? fallbackSource,
    fileName,
    rowCount: safeCount(input.rowCount ?? 0),
    acceptedCount: safeCount(input.acceptedCount ?? 0),
    warningCount: safeCount(input.warningCount ?? 0),
    detectedMatchTime,
    timestampOnly: input.timestampOnly ? true : undefined,
    confidenceAvg: safeOptionalNumber(input.confidenceAvg),
    error,
  };
}

function safeOptionalNumber(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.round(value));
}
