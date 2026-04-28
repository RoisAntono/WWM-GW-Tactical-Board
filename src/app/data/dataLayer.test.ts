import { describe, expect, it } from 'vitest';
import { defaultPlanTeams } from '../../shared/constants';
import type { GuildDatabase, GuildMember, ImportRow, Phase, Player, TacticalPlan } from '../../types/domain';
import { createGuildMemberFromInput } from './domainUtils';
import {
  applyMatchImportRows,
  applyMemberImportRows,
  normalizeGuildDatabase,
  removeGuildMember,
  updateGuildMember,
} from './guildRepository';
import { removeMemberFromPlan } from './planRepository';
import { selectMemberStats } from './selectors';
import { ensureGuildForPlan, syncPlanWithGuild } from './syncEngine';

describe('local data center sync', () => {
  it('updates guild members and syncs linked plan roster snapshots', () => {
    const member = memberFixture({ id: 'member-alpha', ign: 'Alpha', role: 'Attack' });
    const guild = guildFixture([member]);
    const plan = planFixture([
      {
        id: 'player-alpha',
        memberId: member.id,
        ign: 'Alpha',
        role: 'Attack',
        stats: {},
      },
    ]);

    const nextGuild = updateGuildMember(guild, member.id, {
      alias: 'Caller',
      teamId: 'team-defense',
      notes: 'Ready',
    });
    const nextPlan = syncPlanWithGuild(plan, nextGuild);

    expect(nextGuild.members[0]).toMatchObject({
      id: member.id,
      alias: 'Caller',
      teamId: 'team-defense',
      role: 'Defense',
      notes: 'Ready',
    });
    expect(nextPlan.roster[0]).toMatchObject({
      memberId: member.id,
      alias: 'Caller',
      teamId: 'team-defense',
      role: 'Defense',
      notes: 'Ready',
    });
  });

  it('imports members with stable ids and deduplicated IGN values', () => {
    const member = memberFixture({ id: 'member-alpha', ign: 'Alpha', role: 'Attack' });
    const guild = guildFixture([member]);
    const rows = [
      importRowFixture({ id: 'row-1', ign: 'Alpha', alias: 'A1', team: 'Attack' }),
      importRowFixture({ id: 'row-2', ign: 'alpha', alias: 'Duplicate ignored', team: 'Defense' }),
      importRowFixture({ id: 'row-3', ign: 'Beta', team: 'Defense' }),
    ];

    const appended = applyMemberImportRows(guild, rows, 'append', defaultPlanTeams);
    const replaced = applyMemberImportRows(appended, rows, 'replace', defaultPlanTeams);

    expect(appended.members).toHaveLength(2);
    expect(appended.members.find((item) => item.ign === 'Alpha')?.id).toBe(member.id);
    expect(appended.members.find((item) => item.ign === 'Beta')?.role).toBe('Defense');
    expect(replaced.members).toHaveLength(2);
    expect(replaced.members.find((item) => item.ign === 'Alpha')?.id).toBe(member.id);
  });

  it('imports match history, creates pending unknown members, and refreshes aggregated player stats', () => {
    const member = memberFixture({ id: 'member-alpha', ign: 'Alpha', role: 'Attack' });
    const guild = guildFixture([member]);
    const plan = planFixture([
      {
        id: 'player-alpha',
        memberId: member.id,
        ign: 'Alpha',
        role: 'Attack',
        stats: {},
      },
    ]);

    const firstMatchGuild = applyMatchImportRows(
      guild,
      [
        importRowFixture({ id: 'row-alpha-1', ign: 'Alpha', defeated: 4, assist: 2, dpsAvg: 100 }),
        importRowFixture({ id: 'row-unknown', ign: 'Unknown', defeated: 1, dpsAvg: 50 }),
      ],
      defaultPlanTeams,
      { date: '2026-04-20', opponent: 'Red', source: 'csv' },
    );
    const secondMatchGuild = applyMatchImportRows(
      firstMatchGuild,
      [importRowFixture({ id: 'row-alpha-2', ign: 'Alpha', defeated: 6, assist: 4, dpsAvg: 300 })],
      defaultPlanTeams,
      { date: '2026-04-21', opponent: 'Blue', source: 'csv' },
    );
    const syncedPlan = syncPlanWithGuild(plan, secondMatchGuild);

    expect(secondMatchGuild.matches).toHaveLength(2);
    expect(secondMatchGuild.performances).toHaveLength(3);
    expect(secondMatchGuild.members.find((item) => item.ign === 'Unknown')?.status).toBe('Pending Review');
    expect(syncedPlan.roster[0].stats).toMatchObject({
      attendance: 2,
      defeated: 5,
      assist: 3,
      dpsAvg: 200,
      lastPlayed: '2026-04-21',
    });
  });

  it('keeps member CSV summary as a baseline when later match rows are imported', () => {
    const baselineGuild = applyMemberImportRows(
      guildFixture([]),
      [
        importRowFixture({
          id: 'summary-nyx',
          ign: "Nyx'",
          attendance: 16,
          lastPlayed: '18-Apr-2026',
          dpsAvg: 5_962_933,
          tankAvg: 1_850_864,
          healAvg: 6_558,
          siegeAvg: 442_310,
          coinAvg: 1_617,
        }),
      ],
      'append',
      defaultPlanTeams,
    );
    const nextGuild = applyMatchImportRows(
      baselineGuild,
      [
        importRowFixture({
          id: 'match-nyx',
          ign: "Nyx'",
          defeated: 11,
          deaths: 11,
          assist: 21,
          dpsAvg: 7_149_041,
          tankAvg: 3_725_268,
          healAvg: 56_166,
          siegeAvg: 0,
          coinAvg: 792,
        }),
      ],
      defaultPlanTeams,
      { date: '2026-04-19 21:03', opponent: '', source: 'csv' },
    );

    const nyx = nextGuild.members.find((member) => member.ign === "Nyx'");
    const [stats] = selectMemberStats(nextGuild);

    expect(nyx?.summary?.attendance).toBe(16);
    expect(nyx?.summary?.lastPlayed).toBe('18-Apr-2026');
    expect(nextGuild.performances).toHaveLength(1);
    expect(stats.totalMatches).toBe(17);
    expect(stats.lastPlayed).toBe('2026-04-19 21:03');
    expect(stats.averages.defeated).toBe(11);
    expect(stats.averages.assist).toBe(21);
  });

  it('records per-file audit metadata for match imports', () => {
    const guild = guildFixture([]);
    const nextGuild = applyMatchImportRows(
      guild,
      [importRowFixture({ id: 'row-alpha', ign: 'Alpha', defeated: 4, source: 'ocr' })],
      defaultPlanTeams,
      {
        date: '2026-04-28 04:40',
        opponent: 'Red',
        source: 'ocr',
        fileName: '2 screenshots',
        rowCount: 2,
        acceptedCount: 1,
        warningCount: 0,
        detectedMatchTime: '2026-04-28 04:40',
        files: [
          {
            id: 'file-scoreboard',
            source: 'ocr',
            fileName: 'scoreboard.png',
            rowCount: 1,
            acceptedCount: 1,
            warningCount: 0,
          },
          {
            id: 'file-time',
            source: 'ocr',
            fileName: 'time.png',
            rowCount: 0,
            acceptedCount: 0,
            warningCount: 0,
            detectedMatchTime: '2026-04-28 04:40',
            timestampOnly: true,
          },
        ],
      },
    );

    expect(nextGuild.importBatches[0]).toMatchObject({
      source: 'ocr',
      kind: 'match',
      rowCount: 2,
      acceptedCount: 1,
      detectedMatchTime: '2026-04-28 04:40',
      files: [
        { fileName: 'scoreboard.png', rowCount: 1, acceptedCount: 1 },
        { fileName: 'time.png', rowCount: 0, acceptedCount: 0, timestampOnly: true },
      ],
    });
  });

  it('normalizes persisted import batch file metadata', () => {
    const guild = normalizeGuildDatabase({
      ...guildFixture([]),
      importBatches: [
        {
          id: 'batch-1',
          source: 'gemini',
          kind: 'match',
          fileName: 'batch',
          createdAt: '2026-04-28T00:00:00.000Z',
          rowCount: 1,
          acceptedCount: 1,
          warningCount: 0,
          detectedMatchTime: '2026-04-28 04:40',
          files: [
            {
              id: 'file-1',
              source: 'gemini',
              fileName: 'scoreboard.png',
              rowCount: 1,
              acceptedCount: 1,
              warningCount: 0,
              confidenceAvg: 91.7,
            },
          ],
        },
      ],
    });

    expect(guild.importBatches[0].files?.[0]).toMatchObject({
      id: 'file-1',
      source: 'gemini',
      fileName: 'scoreboard.png',
      rowCount: 1,
      acceptedCount: 1,
      confidenceAvg: 92,
    });
  });

  it('deletes a member from guild data and removes all linked plan references', () => {
    const member = memberFixture({ id: 'member-alpha', ign: 'Alpha', role: 'Attack' });
    const guild = guildFixture([member], [
      {
        id: 'match-1',
        date: '2026-04-20',
        opponent: 'Red',
        source: 'csv',
        createdAt: '2026-04-20T00:00:00.000Z',
      },
    ]);
    const guildWithPerformance = {
      ...guild,
      performances: [
        {
          id: 'performance-1',
          matchId: 'match-1',
          memberId: member.id,
          defeated: 1,
          assist: 1,
          damage: 100,
          tank: 0,
          heal: 0,
          siegeDamage: 0,
          funCoin: 0,
        },
      ],
    };
    const plan = planFixture([
      {
        id: 'player-alpha',
        memberId: member.id,
        ign: 'Alpha',
        role: 'Attack',
        stats: {},
      },
    ]);

    const { plan: planWithoutMember, removedPlayerIds } = removeMemberFromPlan(plan, member.id);
    const guildWithoutMember = removeGuildMember(guildWithPerformance, member.id);

    expect(removedPlayerIds).toEqual(['player-alpha']);
    expect(guildWithoutMember.members).toHaveLength(0);
    expect(guildWithoutMember.performances).toHaveLength(0);
    expect(planWithoutMember.roster).toHaveLength(0);
    expect(planWithoutMember.phases[0].playerMarkers).toHaveLength(0);
    expect(planWithoutMember.phases[0].routes[0].assignedPlayerIds).toHaveLength(0);
  });

  it('links imported legacy plans without memberId to a normalized guild database', () => {
    const legacyPlan = planFixture([
      {
        id: 'player-legacy',
        ign: 'Legacy',
        role: 'Attack',
        stats: {},
      },
    ]);

    const { plan, guild } = ensureGuildForPlan(legacyPlan);

    expect(guild.members).toHaveLength(1);
    expect(guild.members[0].ign).toBe('Legacy');
    expect(plan.roster[0].memberId).toBe(guild.members[0].id);
    expect(plan.phases[0].playerMarkers[0].playerId).toBe('player-legacy');
  });
});

function memberFixture(patch: Partial<GuildMember> & { id: string; ign: string }): GuildMember {
  return createGuildMemberFromInput({
    role: 'Flex',
    memberRole: 'DPS',
    rank: 'Member',
    status: 'Member',
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...patch,
  });
}

function guildFixture(
  members: GuildMember[],
  matches: GuildDatabase['matches'] = [],
  performances: GuildDatabase['performances'] = [],
): GuildDatabase {
  return {
    members,
    matches,
    performances,
    importBatches: [],
    updatedAt: '2026-04-20T00:00:00.000Z',
  };
}

function planFixture(roster: Player[]): TacticalPlan {
  const phase: Phase = {
    id: 'phase-opening',
    name: 'Opening',
    playerMarkers: roster.map((player, index) => ({
      id: `marker-${index}`,
      playerId: player.id,
      position: { x: 0.1 + index * 0.05, y: 0.2 },
    })),
    routes: [
      {
        id: 'route-main',
        name: 'Main',
        role: 'Attack',
        points: [],
        style: 'solid',
        assignedPlayerIds: roster.map((player) => player.id),
      },
    ],
    objectives: [],
    zones: [],
    notes: [],
  };

  return {
    version: 1,
    id: 'plan-1',
    title: 'Plan',
    opponent: '',
    roster,
    teams: defaultPlanTeams,
    phases: [phase],
    updatedAt: '2026-04-20T00:00:00.000Z',
  };
}

function importRowFixture(patch: Partial<ImportRow> & { id: string; ign: string }): ImportRow {
  return {
    source: 'csv',
    warnings: [],
    ...patch,
  };
}
