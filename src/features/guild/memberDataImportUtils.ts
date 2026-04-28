import { mergeImportRowsByIgn } from '../../app/data/importMerge';
import { countImportWarnings, getValidImportRows, validateImportRows } from '../../app/data/importValidation';
import { combineMatchDateTime, parseMatchTime } from '../../app/data/matchTime';
import type { ImportBatchFile, ImportRow, ImportSource } from '../../types/domain';
import type { MatchScreenshotSessionFile } from '../roster/MatchScreenshotImportSession';

type ImportKind = 'member' | 'match';
type DetectedMatchTime = { date: string; time?: string; display: string };

export function screenshotFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function updateSessionFile(
  files: MatchScreenshotSessionFile[],
  fileId: string,
  patch: Partial<MatchScreenshotSessionFile>,
): MatchScreenshotSessionFile[] {
  return files.map((file) => (file.id === fileId ? { ...file, ...patch } : file));
}

export function mergeSessionFileRows(files: MatchScreenshotSessionFile[]) {
  const rowsForMerge = files.flatMap((file) => {
    const rows = file.rows ?? [];
    const validRowCount = getValidImportRows(rows, 'match').length;
    return file.matchTime && validRowCount === 0 ? [] : rows;
  });
  const merged = mergeImportRowsByIgn(rowsForMerge);
  return {
    rows: validateImportRows(merged.rows, 'match'),
    duplicateCount: merged.duplicateCount,
  };
}

export function attachImportRowSource(rows: ImportRow[], fileId: string, fileName: string): ImportRow[] {
  const trimmedFileName = fileName.trim();
  return rows.map((row) => ({
    ...row,
    sourceFileId: fileId,
    sourceFileName: trimmedFileName,
    sourceFileIds: [fileId],
    sourceFileNames: trimmedFileName ? [trimmedFileName] : undefined,
  }));
}

export function buildImportFileAudit(input: {
  id: string;
  source: ImportSource;
  fileName: string;
  rows: ImportRow[];
  kind: ImportKind;
  rowCount?: number;
  detectedMatchTime?: string;
  error?: string;
}): ImportBatchFile {
  const validatedRows = validateImportRows(input.rows, input.kind);
  const acceptedCount = getValidImportRows(validatedRows, input.kind).length;
  const detectedMatchTime = input.detectedMatchTime?.trim() || detectMatchTime(validatedRows)?.display;
  const error = input.error?.trim() || undefined;

  return {
    id: input.id,
    source: input.source,
    fileName: input.fileName,
    rowCount: input.rowCount ?? input.rows.length,
    acceptedCount,
    warningCount: countImportWarnings(validatedRows) + (error ? 1 : 0),
    detectedMatchTime,
    timestampOnly: Boolean(detectedMatchTime && acceptedCount === 0),
    confidenceAvg: averageConfidence(validatedRows),
    error,
  };
}

export function buildScreenshotImportFiles(files: MatchScreenshotSessionFile[], source: Extract<ImportSource, 'ocr' | 'gemini'>): ImportBatchFile[] {
  return files.map((file) =>
    buildImportFileAudit({
      id: file.id,
      source,
      fileName: file.name,
      rows: file.rows ?? [],
      kind: 'match',
      rowCount: file.rowCount ?? file.rows?.length ?? 0,
      detectedMatchTime: file.matchTime,
      error: file.error,
    }),
  );
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function formatScreenshotBatchName(files: MatchScreenshotSessionFile[]): string | undefined {
  if (files.length === 0) {
    return undefined;
  }

  return `${files.length} screenshot${files.length === 1 ? '' : 's'}`;
}

export function prepareImportRows(rows: ImportRow[], kind: ImportKind): ImportRow[] {
  const validatedRows = validateImportRows(rows, kind);
  if (getValidImportRows(validatedRows, kind).length === 0) {
    throw new Error(`No valid ${kind} rows found. Check the file or image and try again.`);
  }

  return validatedRows;
}

export function detectMatchTime(rows: ImportRow[]): DetectedMatchTime | undefined {
  for (const row of rows) {
    const parsed = parseMatchTime(row.matchTime);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

export function detectMatchTimeFromSessionFiles(files: MatchScreenshotSessionFile[]): DetectedMatchTime | undefined {
  return files
    .map((file) => ({
      parsed: parseMatchTime(file.matchTime),
      validRowCount: getValidImportRows(file.rows ?? [], 'match').length,
    }))
    .filter((item): item is { parsed: DetectedMatchTime; validRowCount: number } => Boolean(item.parsed))
    .sort((first, second) => first.validRowCount - second.validRowCount)[0]?.parsed;
}

export function fillRowsMatchTime(rows: ImportRow[], matchTime?: string): ImportRow[] {
  if (!matchTime) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    matchTime: row.matchTime?.trim() || matchTime,
  }));
}

export function formatMatchTarget(date: string, time: string, opponent: string): string {
  const displayDate = combineMatchDateTime(date, time) || 'selected date';
  const displayOpponent = opponent.trim() || 'Unknown Opponent';
  return `${displayDate} vs ${displayOpponent}`;
}

export function safeName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'wwm';
}

function averageConfidence(rows: ImportRow[]): number | undefined {
  const values = rows
    .map((row) => row.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) {
    return undefined;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}
