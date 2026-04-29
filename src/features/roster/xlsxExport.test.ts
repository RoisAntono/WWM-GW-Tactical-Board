import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createRosterWorkbookBuffer } from './xlsxExport';
import type { GuildDatabase, TacticalPlan } from '../../types/domain';

describe('xlsx roster export', () => {
  it('creates a styled workbook with roster, member, and match sheets', async () => {
    const buffer = await createRosterWorkbookBuffer(planFixture(), guildFixture());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Members', 'Plan Roster', 'Matches']);

    const roster = workbook.getWorksheet('Plan Roster');
    expect(roster?.getCell('A1').value).toBe('IGN');
    expect(roster?.getCell('A2').value).toBe('Astra');
    expect(roster?.getCell('C2').value).toBe('Attack');
    expect(roster?.getCell('C2').fill).toMatchObject({ type: 'pattern' });
    expect(roster?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(roster?.getColumn(15).width).toBeGreaterThanOrEqual(12);

    const members = workbook.getWorksheet('Members');
    expect(members?.getCell('A2').value).toBe('Astra');
    expect(members?.getCell('G2').value).toBe('Core');

    const matches = workbook.getWorksheet('Matches');
    expect(matches?.getCell('A2').value).toBe('2026-04-29');
    expect(matches?.getCell('D2').value).toBe(1);
  });
});

function planFixture(): TacticalPlan {
  return {
    version: 1,
    id: 'plan-1',
    title: 'Export Test',
    roster: [
      {
        id: 'player-1',
        memberId: 'member-1',
        ign: 'Astra',
        alias: 'Caller',
        role: 'Attack',
        teamId: 'team-red',
        party: '1',
        notes: 'Push lead',
      },
    ],
    teams: [],
    phases: [],
    updatedAt: '2026-04-29T00:00:00.000Z',
  };
}

function guildFixture(): GuildDatabase {
  return {
    members: [
      {
        id: 'member-1',
        ign: 'Astra',
        alias: 'Caller',
        role: 'Attack',
        memberRole: 'DPS',
        teamId: 'team-red',
        party: '1',
        rank: 'Core',
        status: 'Core',
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
      },
    ],
    matches: [
      {
        id: 'match-1',
        date: '2026-04-29',
        opponent: 'Opponent',
        source: 'manual',
        createdAt: '2026-04-29T00:00:00.000Z',
      },
    ],
    performances: [
      {
        id: 'performance-1',
        matchId: 'match-1',
        memberId: 'member-1',
        defeated: 6,
        deaths: 1,
        assist: 3,
        damage: 1200,
        tank: 0,
        heal: 0,
        siegeDamage: 500,
        funCoin: 8,
      },
    ],
    importBatches: [],
    updatedAt: '2026-04-29T00:00:00.000Z',
  };
}
