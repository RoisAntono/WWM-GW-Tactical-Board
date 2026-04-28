import { describe, expect, it } from 'vitest';
import { parseRosterCsv } from './csvImport';

describe('CSV import', () => {
  it('maps summary stats Last Played (GW) headers for member imports', () => {
    const rows = parseRosterCsv(
      [
        'IGN,Attendance,Last Played (GW),Defeated AVG,Assist AVG,Deaths AVG,DPS AVG,Heal AVG,Tank AVG,Siege AVG,Coin AVG',
        "Nyx',16,18-Apr-2026,3,17,1,5962933,6558,1850864,442310,1617",
      ].join('\n'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ign: "Nyx'",
      attendance: 16,
      lastPlayed: '18-Apr-2026',
      defeated: 3,
      assist: 17,
      deaths: 1,
      dpsAvg: 5962933,
      healAvg: 6558,
      tankAvg: 1850864,
      siegeAvg: 442310,
      coinAvg: 1617,
      warnings: [],
    });
  });

  it('maps combat record Player Name and Date headers for match imports', () => {
    const rows = parseRosterCsv(
      [
        'Player Name,Date,Kills,Assist,Deaths,Fun Coin,Damage,Tank,Heal,Siege Damage',
        "Nyx',2026/04/04 20:49,12,48,4,1320,6415291,3229337,19051,231261",
      ].join('\n'),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ign: "Nyx'",
      matchTime: '2026/04/04 20:49',
      defeated: 12,
      assist: 48,
      deaths: 4,
      coinAvg: 1320,
      dpsAvg: 6415291,
      tankAvg: 3229337,
      healAvg: 19051,
      siegeAvg: 231261,
      warnings: [],
    });
  });
});
