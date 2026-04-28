import { describe, expect, it } from 'vitest';
import type { ImportRow } from '../../types/domain';
import { createImportBatch, getValidImportRows, updateImportRowField, validateImportRows } from './importValidation';

describe('import validation', () => {
  it('treats an emptied numeric review field as undefined and refreshes warnings', () => {
    const row = importRowFixture({ dpsAvg: 1200 });
    const nextRow = updateImportRowField(row, 'dpsAvg', '', 'match');

    expect(nextRow.dpsAvg).toBeUndefined();
    expect(nextRow.warnings).toContain('No match stats detected; review manually');
  });

  it('removes managed warnings after a row is corrected', () => {
    const row = importRowFixture({
      ign: '',
      defeated: 4,
      warnings: ['Missing IGN'],
    });
    const nextRow = updateImportRowField(row, 'ign', 'Alpha', 'match');

    expect(nextRow.ign).toBe('Alpha');
    expect(nextRow.warnings).not.toContain('Missing IGN');
  });

  it('returns no valid match rows when IGN or match stats are missing', () => {
    const rows = validateImportRows(
      [
        importRowFixture({ ign: '', defeated: 1 }),
        importRowFixture({ ign: 'NoStats', defeated: undefined, dpsAvg: undefined }),
      ],
      'match',
    );

    expect(getValidImportRows(rows, 'match')).toHaveLength(0);
  });

  it('stores per-file import audit metadata without raw file content', () => {
    const batch = createImportBatch({
      id: 'batch-1',
      source: 'ocr',
      kind: 'match',
      fileName: '2 screenshots',
      rowCount: 3,
      acceptedCount: 2,
      warningCount: 1,
      detectedMatchTime: '2026-04-28 04:40',
      files: [
        {
          id: 'file-1',
          source: 'ocr',
          fileName: 'scoreboard-a.png',
          rowCount: 2,
          acceptedCount: 2,
          warningCount: 1,
          confidenceAvg: 82.4,
        },
        {
          id: 'file-2',
          source: 'ocr',
          fileName: 'time-only.png',
          rowCount: 0,
          acceptedCount: 0,
          warningCount: 0,
          detectedMatchTime: '2026-04-28 04:40',
          timestampOnly: true,
        },
      ],
    });

    expect(batch.files).toMatchObject([
      {
        id: 'file-1',
        source: 'ocr',
        fileName: 'scoreboard-a.png',
        rowCount: 2,
        acceptedCount: 2,
        warningCount: 1,
        confidenceAvg: 82,
      },
      {
        id: 'file-2',
        source: 'ocr',
        fileName: 'time-only.png',
        rowCount: 0,
        acceptedCount: 0,
        warningCount: 0,
        detectedMatchTime: '2026-04-28 04:40',
        timestampOnly: true,
      },
    ]);
    expect(JSON.stringify(batch)).not.toContain('data:image');
  });
});

function importRowFixture(patch: Partial<ImportRow>): ImportRow {
  return {
    id: 'row-1',
    ign: 'Alpha',
    source: 'csv',
    warnings: [],
    ...patch,
  };
}
