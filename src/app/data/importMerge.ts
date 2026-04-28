import type { ImportRow, ImportRowSourceSnapshot } from '../../types/domain';
import { normalizeIgn } from './domainUtils';

export type MergeImportRowsResult = {
  rows: ImportRow[];
  duplicateCount: number;
};

const duplicateWarning = 'Duplicate IGN merged from multiple screenshots; review stats';
const conflictWarning = 'Conflicting duplicate stats; review merged row';

const textFields = [
  'alias',
  'team',
  'party',
  'matchTime',
  'lastPlayed',
  'notes',
] as const satisfies readonly (keyof ImportRow)[];

const numericFields = [
  'attendance',
  'defeated',
  'deaths',
  'assist',
  'dpsAvg',
  'healAvg',
  'tankAvg',
  'siegeAvg',
  'coinAvg',
] as const satisfies readonly (keyof ImportRow)[];

export function mergeImportRowsByIgn(rows: ImportRow[]): MergeImportRowsResult {
  const groups = new Map<string, ImportRow[]>();
  const orderedKeys: string[] = [];
  const passthroughRows: ImportRow[] = [];

  rows.forEach((row) => {
    const ignKey = normalizeIgn(row.ign);
    if (!ignKey) {
      passthroughRows.push(row);
      return;
    }

    if (!groups.has(ignKey)) {
      groups.set(ignKey, []);
      orderedKeys.push(ignKey);
    }
    groups.get(ignKey)?.push(row);
  });

  let duplicateCount = 0;
  const mergedRows = orderedKeys.flatMap((key) => {
    const group = groups.get(key) ?? [];
    if (group.length <= 1) {
      return group;
    }

    duplicateCount += group.length - 1;
    return [mergeDuplicateRows(group)];
  });

  return {
    rows: [...mergedRows, ...passthroughRows],
    duplicateCount,
  };
}

function mergeDuplicateRows(rows: ImportRow[]): ImportRow {
  const orderedRows = [...rows].sort((first, second) => rowCompletenessScore(second) - rowCompletenessScore(first));
  const baseRow = orderedRows[0];
  const merged: ImportRow = {
    ...baseRow,
    warnings: Array.from(new Set(rows.flatMap((row) => row.warnings))),
  };

  merged.ign = chooseDisplayIgn(rows);
  merged.alias = firstTextValue(orderedRows, 'alias');
  merged.team = firstTextValue(orderedRows, 'team');
  merged.party = firstTextValue(orderedRows, 'party');
  merged.matchTime = firstTextValue(orderedRows, 'matchTime');
  merged.lastPlayed = firstTextValue(orderedRows, 'lastPlayed');
  merged.notes = firstTextValue(orderedRows, 'notes');
  merged.role = orderedRows.find((row) => row.role)?.role;
  merged.memberRole = orderedRows.find((row) => row.memberRole)?.memberRole;
  merged.rank = orderedRows.find((row) => row.rank)?.rank;
  merged.confidence = highestConfidence(rows);
  const sourceFileIds = uniqueSourceValues(rows, 'sourceFileIds', 'sourceFileId');
  const sourceFileNames = uniqueSourceValues(rows, 'sourceFileNames', 'sourceFileName');
  merged.sourceFileIds = sourceFileIds.length ? sourceFileIds : undefined;
  merged.sourceFileId = sourceFileIds[0];
  merged.sourceFileNames = sourceFileNames.length ? sourceFileNames : undefined;
  merged.sourceFileName = sourceFileNames[0];
  merged.mergedSourceRows = rows.map(rowToSourceSnapshot);

  let hasNumericConflict = false;
  numericFields.forEach((field) => {
    const values = orderedRows
      .map((row) => row[field])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (values.length === 0) {
      delete merged[field];
      return;
    }

    if (new Set(values.map((value) => String(value))).size > 1) {
      hasNumericConflict = true;
    }
    merged[field] = values[0] as never;
  });

  merged.warnings = Array.from(
    new Set([...merged.warnings, duplicateWarning, ...(hasNumericConflict ? [conflictWarning] : [])]),
  );

  return merged;
}

function rowCompletenessScore(row: ImportRow): number {
  const numericScore = numericFields.filter((field) => {
    const value = row[field];
    return typeof value === 'number' && Number.isFinite(value);
  }).length;
  const textScore = textFields.filter((field) => Boolean(String(row[field] ?? '').trim())).length;
  const confidenceScore = row.confidence !== undefined ? row.confidence / 100 : 0;

  return numericScore * 4 + textScore + confidenceScore;
}

function chooseDisplayIgn(rows: ImportRow[]): string {
  return [...rows]
    .map((row) => row.ign.trim())
    .filter(Boolean)
    .sort((first, second) => second.length - first.length)[0];
}

function firstTextValue(rows: ImportRow[], field: (typeof textFields)[number]): string | undefined {
  return rows.map((row) => row[field]).find((value): value is string => Boolean(value?.trim()))?.trim();
}

function highestConfidence(rows: ImportRow[]): number | undefined {
  const values = rows
    .map((row) => row.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length ? Math.max(...values) : undefined;
}

function uniqueSourceValues(
  rows: ImportRow[],
  arrayField: 'sourceFileIds' | 'sourceFileNames',
  singleField: 'sourceFileId' | 'sourceFileName',
): string[] {
  const values = rows.flatMap((row) => {
    const arrayValues = row[arrayField];
    if (Array.isArray(arrayValues) && arrayValues.length) {
      return arrayValues;
    }

    const singleValue = row[singleField];
    return singleValue ? [singleValue] : [];
  });

  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function rowToSourceSnapshot(row: ImportRow): ImportRowSourceSnapshot {
  return {
    id: row.id,
    sourceFileName: row.sourceFileName,
    ign: row.ign,
    confidence: row.confidence,
    defeated: row.defeated,
    deaths: row.deaths,
    assist: row.assist,
    dpsAvg: row.dpsAvg,
    healAvg: row.healAvg,
    tankAvg: row.tankAvg,
    siegeAvg: row.siegeAvg,
    coinAvg: row.coinAvg,
    warnings: row.warnings,
  };
}
