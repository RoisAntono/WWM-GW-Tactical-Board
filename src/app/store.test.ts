import { beforeEach, describe, expect, it } from 'vitest';
import { defaultLayerVisibility, defaultObjectiveCategoryVisibility, defaultPlanTeams } from '../shared/constants';
import type { GuildDatabase, GuildMember, ImportRow, Phase, Player, TacticalPlan } from '../types/domain';
import { createGuildMemberFromInput } from './data/domainUtils';
import { normalizePersistedState, usePlanStore } from './store';

describe('workspace store history', () => {
  beforeEach(() => {
    usePlanStore.setState(
      {
        ...usePlanStore.getInitialState(),
        historyPast: [],
        historyFuture: [],
        selectedPlayerId: undefined,
        selectedRouteId: undefined,
        selectedObjectiveId: undefined,
        selectedNoteId: undefined,
        tool: 'select',
        layerVisibility: defaultLayerVisibility,
        objectiveCategoryVisibility: defaultObjectiveCategoryVisibility,
        briefingMode: false,
      },
      true,
    );
  });

  it('undoes and redoes guild member updates together with linked roster snapshots', () => {
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
    usePlanStore.setState({ plan, guild, activePhaseId: plan.phases[0].id, historyPast: [], historyFuture: [] });

    usePlanStore.getState().updateGuildMember(member.id, { alias: 'Caller', teamId: 'team-defense' });
    expect(usePlanStore.getState().guild.members[0].alias).toBe('Caller');
    expect(usePlanStore.getState().plan.roster[0]).toMatchObject({ alias: 'Caller', teamId: 'team-defense' });

    usePlanStore.getState().undo();
    expect(usePlanStore.getState().guild.members[0].alias).toBeUndefined();
    expect(usePlanStore.getState().plan.roster[0].alias).toBeUndefined();

    usePlanStore.getState().redo();
    expect(usePlanStore.getState().guild.members[0].alias).toBe('Caller');
    expect(usePlanStore.getState().plan.roster[0].alias).toBe('Caller');
  });

  it('undoes and redoes match imports with performances, pending members, and computed stats', () => {
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
    usePlanStore.setState({ plan, guild, activePhaseId: plan.phases[0].id, historyPast: [], historyFuture: [] });

    usePlanStore.getState().applyMatchImportRows(
      [
        importRowFixture({ id: 'row-alpha', ign: 'Alpha', defeated: 6, assist: 3, dpsAvg: 300 }),
        importRowFixture({ id: 'row-unknown', ign: 'Unknown', defeated: 1, dpsAvg: 50 }),
      ],
      { date: '2026-04-21', opponent: 'Blue', source: 'csv' },
    );

    expect(usePlanStore.getState().guild.matches).toHaveLength(1);
    expect(usePlanStore.getState().guild.performances).toHaveLength(2);
    expect(usePlanStore.getState().guild.importBatches).toHaveLength(1);
    expect(usePlanStore.getState().guild.members.find((item) => item.ign === 'Unknown')?.status).toBe('Pending Review');
    expect(usePlanStore.getState().plan.roster[0].stats).toMatchObject({ defeated: 6, assist: 3, dpsAvg: 300 });

    usePlanStore.getState().undo();
    expect(usePlanStore.getState().guild.matches).toHaveLength(0);
    expect(usePlanStore.getState().guild.performances).toHaveLength(0);
    expect(usePlanStore.getState().guild.importBatches).toHaveLength(0);
    expect(usePlanStore.getState().guild.members.some((item) => item.ign === 'Unknown')).toBe(false);
    expect(usePlanStore.getState().plan.roster[0].stats).toEqual({});

    usePlanStore.getState().redo();
    expect(usePlanStore.getState().guild.matches).toHaveLength(1);
    expect(usePlanStore.getState().guild.performances).toHaveLength(2);
    expect(usePlanStore.getState().guild.importBatches).toHaveLength(1);
    expect(usePlanStore.getState().plan.roster[0].stats).toMatchObject({ defeated: 6, assist: 3, dpsAvg: 300 });
  });

  it('normalizes v8 persisted state with import batches and linked member ids', () => {
    const legacyPlan = planFixture([
      {
        id: 'player-legacy',
        ign: 'Legacy',
        role: 'Attack',
        stats: {},
      },
    ]);
    const hydrated = normalizePersistedState({
      plan: legacyPlan,
      guild: { members: [], matches: [], performances: [], updatedAt: '2026-04-20T00:00:00.000Z' } as unknown as GuildDatabase,
      activePhaseId: legacyPlan.phases[0].id,
    } as never);

    expect(hydrated.guild.importBatches).toEqual([]);
    expect(hydrated.guild.members).toHaveLength(1);
    expect(hydrated.plan.roster[0].memberId).toBe(hydrated.guild.members[0].id);
  });

  it('restores shared workspace snapshots with active phase and history', () => {
    const member = memberFixture({ id: 'member-alpha', ign: 'Alpha', role: 'Attack' });
    const guild = guildFixture([member]);
    const incomingPlan = planFixture([
      {
        id: 'player-alpha',
        memberId: member.id,
        ign: 'Alpha',
        role: 'Attack',
        stats: {},
      },
    ]);
    const battlePhase: Phase = {
      id: 'phase-battle',
      name: 'Battle',
      playerMarkers: [],
      routes: [],
      objectives: [],
      zones: [],
      notes: [],
    };
    incomingPlan.phases = [...incomingPlan.phases, battlePhase];

    usePlanStore.setState({
      selectedPlayerId: 'player-old',
      selectedRouteId: 'route-old',
      selectedObjectiveId: 'objective-old',
      selectedNoteId: 'note-old',
      tool: 'remove',
    });

    usePlanStore.getState().setWorkspaceSnapshot({
      plan: incomingPlan,
      guild,
      activePhaseId: 'phase-battle',
    });

    expect(usePlanStore.getState().plan.id).toBe('plan-1');
    expect(usePlanStore.getState().activePhaseId).toBe('phase-battle');
    expect(usePlanStore.getState().guild.members[0].id).toBe('member-alpha');
    expect(usePlanStore.getState().selectedPlayerId).toBeUndefined();
    expect(usePlanStore.getState().selectedRouteId).toBeUndefined();
    expect(usePlanStore.getState().selectedObjectiveId).toBeUndefined();
    expect(usePlanStore.getState().selectedNoteId).toBeUndefined();
    expect(usePlanStore.getState().tool).toBe('select');
    expect(usePlanStore.getState().historyPast).toHaveLength(1);
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

function guildFixture(members: GuildMember[]): GuildDatabase {
  return {
    members,
    matches: [],
    performances: [],
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
    routes: [],
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
