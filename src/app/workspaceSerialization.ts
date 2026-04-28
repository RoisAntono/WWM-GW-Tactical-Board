import type { GuildDatabase, TacticalPlan, WorkspaceBackup } from '../types/domain';

export function serializeWorkspaceBackup(plan: TacticalPlan, guild: GuildDatabase): string {
  return JSON.stringify(
    {
      version: 1,
      plan,
      guild,
    } satisfies WorkspaceBackup,
    null,
    2,
  );
}

export function parseWorkspaceBackup(content: string): WorkspaceBackup {
  const parsed = JSON.parse(content) as Partial<WorkspaceBackup>;
  if (parsed.version !== 1 || !parsed.plan || !parsed.guild) {
    throw new Error('Invalid WWM workspace backup.');
  }

  return {
    version: 1,
    plan: parsed.plan,
    guild: parsed.guild,
  };
}

export function isWorkspaceBackup(value: unknown): value is WorkspaceBackup {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Partial<WorkspaceBackup>).version === 1 &&
    Boolean((value as Partial<WorkspaceBackup>).plan) &&
    Boolean((value as Partial<WorkspaceBackup>).guild)
  );
}
