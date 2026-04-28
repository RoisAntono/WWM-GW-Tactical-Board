import { describe, expect, it } from 'vitest';
import type { GuildDatabase, TacticalPlan } from '../types/domain';
import { createPlanImportReport, createWorkspaceImportReport } from './backupCompatibility';

describe('backup compatibility reports', () => {
  it('reports workspace backup version and counts', () => {
    const report = createWorkspaceImportReport({
      version: 1,
      plan: planFixture(),
      guild: guildFixture(),
    });

    expect(report.kind).toBe('workspace');
    expect(report.title).toBe('Workspace backup restored');
    expect(report.message).toContain('Format: Workspace backup v1');
    expect(report.message).toContain('Members: 1');
    expect(report.message).toContain('Settings were not included');
  });

  it('reports legacy guild-only restore as plan-preserving', () => {
    const report = createWorkspaceImportReport(guildFixture());

    expect(report.kind).toBe('guild');
    expect(report.message).toContain('Format: Guild database backup');
    expect(report.message).toContain('Current tactical board plan was kept');
  });

  it('reports plan import counts', () => {
    const report = createPlanImportReport(planFixture());

    expect(report.kind).toBe('plan');
    expect(report.message).toContain('Roster: 1 players');
    expect(report.message).toContain('Phases: 1 phases');
  });
});

function guildFixture(): GuildDatabase {
  return {
    members: [{ id: 'member-1' } as never],
    matches: [{ id: 'match-1' } as never],
    performances: [{ id: 'performance-1' } as never],
    importBatches: [{ id: 'batch-1' } as never],
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}

function planFixture(): TacticalPlan {
  return {
    version: 1,
    id: 'plan-1',
    title: 'Backup Plan',
    roster: [{ id: 'player-1' } as never],
    teams: [],
    phases: [{ id: 'phase-1' } as never],
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}
