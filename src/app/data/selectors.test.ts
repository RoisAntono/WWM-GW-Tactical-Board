import { describe, expect, it } from 'vitest';
import type { GuildDatabase } from '../../types/domain';
import { createGuildMemberFromInput } from './domainUtils';
import { selectMemberCsvRows, selectMemberStats } from './selectors';

describe('guild selectors', () => {
  it('adds imported match performances on top of member CSV summary attendance', () => {
    const member = createGuildMemberFromInput({
      id: 'member-nyx',
      ign: "Nyx'",
      summary: {
        attendance: 16,
        lastPlayed: '18-Apr-2026',
        damageAvg: 5_962_933,
        tankAvg: 1_850_864,
        healAvg: 6_558,
        siegeDamageAvg: 442_310,
        funCoinAvg: 1_617,
      },
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
    });
    const guild: GuildDatabase = {
      members: [member],
      matches: [
        {
          id: 'match-apr-19',
          date: '2026-04-19 21:03',
          opponent: 'Unknown Opponent',
          source: 'csv',
          createdAt: '2026-04-19T21:03:00.000Z',
        },
      ],
      performances: [
        {
          id: 'performance-nyx-apr-19',
          matchId: 'match-apr-19',
          memberId: 'member-nyx',
          defeated: 11,
          deaths: 11,
          assist: 21,
          damage: 7_149_041,
          tank: 3_725_268,
          heal: 56_166,
          siegeDamage: 0,
          funCoin: 792,
        },
      ],
      importBatches: [],
      updatedAt: '2026-04-19T21:03:00.000Z',
    };

    const [stats] = selectMemberStats(guild);

    expect(stats.totalMatches).toBe(17);
    expect(stats.lastPlayed).toBe('2026-04-19 21:03');
    expect(stats.totals.damage).toBe(5_962_933 * 16 + 7_149_041);
    expect(stats.averages.defeated).toBe(11);
    expect(stats.averages.deaths).toBe(11);
    expect(stats.averages.assist).toBe(21);
    expect(stats.averages.damage).toBe(6_032_704);
    expect(stats.averages.tank).toBe(1_961_123);
    expect(stats.averages.heal).toBe(9_476);
    expect(stats.averages.siegeDamage).toBe(416_292);
    expect(stats.averages.funCoin).toBe(1_568);
  });

  it('uses summary attendance for combat metrics only when those summary metrics exist', () => {
    const member = createGuildMemberFromInput({
      id: 'member-alpha',
      ign: 'Alpha',
      summary: {
        attendance: 4,
        defeatedAvg: 0,
        deathsAvg: 2,
        assistAvg: 10,
      },
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
    });
    const guild: GuildDatabase = {
      members: [member],
      matches: [
        {
          id: 'match-apr-19',
          date: '2026-04-19',
          opponent: 'Unknown Opponent',
          source: 'csv',
          createdAt: '2026-04-19T00:00:00.000Z',
        },
      ],
      performances: [
        {
          id: 'performance-alpha-apr-19',
          matchId: 'match-apr-19',
          memberId: 'member-alpha',
          defeated: 4,
          deaths: 0,
          assist: 30,
          damage: 0,
          tank: 0,
          heal: 0,
          siegeDamage: 0,
          funCoin: 0,
        },
      ],
      importBatches: [],
      updatedAt: '2026-04-19T00:00:00.000Z',
    };

    const [stats] = selectMemberStats(guild);

    expect(stats.totalMatches).toBe(5);
    expect(stats.averages.defeated).toBe(1);
    expect(stats.averages.assist).toBe(14);
    expect(stats.averages.deaths).toBe(2);
  });

  it('exports member CSV rows with defeated and deaths averages and without total damage', () => {
    const member = createGuildMemberFromInput({
      id: 'member-alpha',
      ign: 'Alpha',
      summary: {
        attendance: 2,
        defeatedAvg: 4,
        deathsAvg: 1,
        assistAvg: 12,
        damageAvg: 1_000,
      },
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
    });
    const guild: GuildDatabase = {
      members: [member],
      matches: [],
      performances: [],
      importBatches: [],
      updatedAt: '2026-04-19T00:00:00.000Z',
    };

    const [row] = selectMemberCsvRows(selectMemberStats(guild));

    expect(row['Defeated AVG']).toBe(4);
    expect(row['Deaths AVG']).toBe(1);
    expect(row['Assist AVG']).toBe(12);
    expect(row).not.toHaveProperty('Kill AVG');
    expect(row).not.toHaveProperty('Total Damage');
  });
});
