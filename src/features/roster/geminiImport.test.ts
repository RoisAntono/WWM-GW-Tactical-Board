import { describe, expect, it } from 'vitest';
import { mapGeminiRowsToImportRows, parseGeminiResponsePayload, parseGeminiResponsePayloadWithMeta } from './geminiImport';

describe('Gemini import mapping', () => {
  it('maps Gemini rows into match import rows', () => {
    const [row] = mapGeminiRowsToImportRows([
      {
        ign: 'Dayue',
        defeated: 12,
        deaths: 2,
        assist: 8,
        damage: 123456,
        tank: 4567,
        heal: 8901,
        siegeDamage: 222,
        funCoin: 7,
        confidence: 0.92,
      },
    ]);

    expect(row.source).toBe('gemini');
    expect(row.ign).toBe('Dayue');
    expect(row.defeated).toBe(12);
    expect(row.deaths).toBe(2);
    expect(row.assist).toBe(8);
    expect(row.dpsAvg).toBe(123456);
    expect(row.tankAvg).toBe(4567);
    expect(row.healAvg).toBe(8901);
    expect(row.siegeAvg).toBe(222);
    expect(row.coinAvg).toBe(7);
    expect(row.confidence).toBe(92);
  });

  it('adds warnings for rows missing IGN or useful match stats', () => {
    const [row] = mapGeminiRowsToImportRows([{ notes: 'Unclear row' }]);

    expect(row.source).toBe('gemini');
    expect(row.warnings).toContain('Missing IGN');
    expect(row.warnings).toContain('No match stats detected; review manually');
  });

  it('parses Gemini generateContent JSON text payloads', () => {
    const rows = parseGeminiResponsePayload({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  rows: [{ ign: 'Astra', assist: 4, damage: 1000 }],
                }),
              },
            ],
          },
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: 'gemini',
      ign: 'Astra',
      assist: 4,
      dpsAvg: 1000,
    });
  });

  it('parses top-level match time metadata', () => {
    const result = parseGeminiResponsePayloadWithMeta({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  matchTime: '2026/04/26 21:54',
                  rows: [],
                }),
              },
            ],
          },
        },
      ],
    });

    expect(result.matchTime).toBe('2026-04-26 21:54');
    expect(result.rows).toHaveLength(0);
  });

  it('does not promote row-level match time into batch metadata', () => {
    const result = parseGeminiResponsePayloadWithMeta({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  rows: [{ ign: 'Astra', assist: 4, damage: 1000, matchTime: '2026/04/28 04:40' }],
                }),
              },
            ],
          },
        },
      ],
    });

    expect(result.matchTime).toBeUndefined();
    expect(result.rows[0].matchTime).toBe('2026/04/28 04:40');
  });
});
