import type { GuildDatabase, TacticalPlan, WorkspaceSnapshot } from '../types/domain';

export const workspaceHistoryLimit = 80;

type WorkspaceState = {
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
};

export function createWorkspaceSnapshot(state: WorkspaceState): WorkspaceSnapshot {
  return {
    plan: state.plan,
    guild: state.guild,
    activePhaseId: state.activePhaseId,
  };
}

export function appendWorkspaceHistory(history: WorkspaceSnapshot[], state: WorkspaceState): WorkspaceSnapshot[] {
  return [...history, createWorkspaceSnapshot(state)].slice(-workspaceHistoryLimit);
}

export function prependWorkspaceFuture(history: WorkspaceSnapshot[], state: WorkspaceState): WorkspaceSnapshot[] {
  return [createWorkspaceSnapshot(state), ...history].slice(0, workspaceHistoryLimit);
}
