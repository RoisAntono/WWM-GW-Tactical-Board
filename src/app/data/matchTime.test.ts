import { describe, expect, it } from 'vitest';
import { parseMatchTime } from './matchTime';

describe('match time parsing', () => {
  it('reads match time from battle results text', () => {
    expect(parseMatchTime('Battle Results Group Guild War Point Match Time 2026/04/26 21:54')).toEqual({
      date: '2026-04-26',
      time: '21:54',
      display: '2026-04-26 21:54',
    });
  });

  it('accepts OCR spacing around date and time separators', () => {
    expect(parseMatchTime('2026 / 4 / 6 9 : 05')).toEqual({
      date: '2026-04-06',
      time: '09:05',
      display: '2026-04-06 09:05',
    });
  });

  it('rejects invalid date-like text', () => {
    expect(parseMatchTime('2026/14/99 33:90')).toBeUndefined();
  });
});
