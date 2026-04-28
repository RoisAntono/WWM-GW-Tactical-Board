import { describe, expect, it } from 'vitest';
import { defaultPlanTeams } from '../shared/constants';
import type { GuildDatabase, TacticalPlan } from '../types/domain';
import { serializeWorkspaceBackup, parseWorkspaceBackup } from './workspaceSerialization';

describe('workspace serialization', () => {
  it('roundtrips plan and guild data without settings', () => {
    const plan: TacticalPlan = {
      version: 1,
      id: 'plan-1',
      title: 'Plan',
      opponent: '',
      roster: [],
      teams: defaultPlanTeams,
      phases: [
        {
          id: 'phase-1',
          name: 'Opening',
          playerMarkers: [],
          routes: [],
          objectives: [],
          zones: [],
          notes: [],
        },
      ],
      updatedAt: '2026-04-20T00:00:00.000Z',
    };
    const guild: GuildDatabase = {
      members: [],
      matches: [],
      performances: [],
      importBatches: [],
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    const serialized = serializeWorkspaceBackup(plan, guild);
    const parsed = parseWorkspaceBackup(serialized);

    expect(parsed.version).toBe(1);
    expect(parsed.plan.id).toBe(plan.id);
    expect(parsed.guild).toEqual(guild);
    expect(serialized).not.toContain('geminiApiKey');
  });
});
