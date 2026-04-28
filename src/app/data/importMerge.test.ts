import { describe, expect, it } from 'vitest';
import type { ImportRow } from '../../types/domain';
import { mergeImportRowsByIgn } from './importMerge';

describe('import row merge', () => {
  it('merges duplicate IGN rows and keeps the most complete stats', () => {
    const result = mergeImportRowsByIgn([
      importRowFixture({ id: 'row-1', ign: 'Alpha', defeated: 5, assist: 2, dpsAvg: undefined }),
      importRowFixture({ id: 'row-2', ign: 'alpha ', defeated: 5, assist: 2, dpsAvg: 1200, tankAvg: 300 }),
    ]);

    expect(result.duplicateCount).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      ign: 'Alpha',
      defeated: 5,
      assist: 2,
      dpsAvg: 1200,
      tankAvg: 300,
    });
    expect(result.rows[0].warnings).toContain('Duplicate IGN merged from multiple screenshots; review stats');
  });

  it('adds a conflict warning when duplicate numeric stats disagree', () => {
    const result = mergeImportRowsByIgn([
      importRowFixture({ id: 'row-1', ign: 'Alpha', defeated: 5, confidence: 80 }),
      importRowFixture({ id: 'row-2', ign: 'Alpha', defeated: 6, confidence: 70 }),
    ]);

    expect(result.rows[0].defeated).toBe(5);
    expect(result.rows[0].warnings).toContain('Conflicting duplicate stats; review merged row');
  });

  it('keeps all source screenshot names when duplicate rows are merged', () => {
    const result = mergeImportRowsByIgn([
      importRowFixture({
        id: 'row-1',
        ign: 'Alpha',
        defeated: 5,
        sourceFileId: 'file-a',
        sourceFileName: 'scoreboard-a.png',
        sourceFileIds: ['file-a'],
        sourceFileNames: ['scoreboard-a.png'],
      }),
      importRowFixture({
        id: 'row-2',
        ign: 'Alpha',
        assist: 3,
        sourceFileId: 'file-b',
        sourceFileName: 'scoreboard-b.png',
        sourceFileIds: ['file-b'],
        sourceFileNames: ['scoreboard-b.png'],
      }),
    ]);

    expect(result.rows[0].sourceFileNames).toEqual(['scoreboard-a.png', 'scoreboard-b.png']);
    expect(result.rows[0].sourceFileIds).toEqual(['file-a', 'file-b']);
    expect(result.rows[0].mergedSourceRows).toMatchObject([
      { id: 'row-1', sourceFileName: 'scoreboard-a.png', defeated: 5 },
      { id: 'row-2', sourceFileName: 'scoreboard-b.png', assist: 3 },
    ]);
  });

  it('does not merge rows with missing IGN', () => {
    const result = mergeImportRowsByIgn([
      importRowFixture({ id: 'row-1', ign: '', dpsAvg: 1000 }),
      importRowFixture({ id: 'row-2', ign: '', dpsAvg: 1200 }),
    ]);

    expect(result.duplicateCount).toBe(0);
    expect(result.rows).toHaveLength(2);
  });
});

function importRowFixture(patch: Partial<ImportRow>): ImportRow {
  return {
    id: 'row-1',
    ign: 'Alpha',
    source: 'ocr',
    warnings: [],
    ...patch,
  };
}
