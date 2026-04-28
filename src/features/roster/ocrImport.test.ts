import { describe, expect, it } from 'vitest';
import { parseOcrText } from './ocrImport';

describe('OCR import mapping', () => {
  it('maps the third scoreboard stat column into deaths', () => {
    const [row] = parseOcrText('Alpha 15 7 2 1000 4023857 17131 0 131578', 82);

    expect(row.ign).toBe('Alpha');
    expect(row.defeated).toBe(15);
    expect(row.assist).toBe(7);
    expect(row.deaths).toBe(2);
    expect(row.coinAvg).toBe(1000);
    expect(row.dpsAvg).toBe(4023857);
    expect(row.tankAvg).toBe(17131);
    expect(row.healAvg).toBe(0);
    expect(row.siegeAvg).toBe(131578);
  });
});
