import type { GuildDatabase, TacticalPlan, WorkspaceBackup } from '../types/domain';
import { isWorkspaceBackup } from './workspaceSerialization';

export type BackupCompatibilityReport = {
  kind: 'workspace' | 'guild' | 'plan';
  title: string;
  message: string;
};

export function createWorkspaceImportReport(value: unknown): BackupCompatibilityReport {
  if (isWorkspaceBackup(value)) {
    return {
      kind: 'workspace',
      title: 'Workspace backup restored',
      message: formatReportLines([
        `Format: Workspace backup v${value.version}`,
        `Plan: ${readPlanTitle(value.plan)}`,
        ...formatGuildCounts(value.guild),
        'Settings were not included in this backup and were left unchanged.',
      ]),
    };
  }

  const guild = extractGuild(value);
  return {
    kind: 'guild',
    title: 'Guild backup restored',
    message: formatReportLines([
      'Format: Guild database backup',
      ...formatGuildCounts(guild),
      'Current tactical board plan was kept and relinked to the restored guild data.',
      'Settings were not included in this backup and were left unchanged.',
    ]),
  };
}

export function createPlanImportReport(plan: TacticalPlan): BackupCompatibilityReport {
  return {
    kind: 'plan',
    title: 'Plan file imported',
    message: formatReportLines([
      'Format: Tactical plan v1',
      `Plan: ${readPlanTitle(plan)}`,
      `Roster: ${safeArrayLength(plan.roster)} players`,
      `Phases: ${safeArrayLength(plan.phases)} phases`,
      'Guild data was kept and relinked to the imported plan.',
    ]),
  };
}

function extractGuild(value: unknown): Partial<GuildDatabase> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const record = value as { guild?: unknown };
  return typeof record.guild === 'object' && record.guild !== null
    ? (record.guild as Partial<GuildDatabase>)
    : (value as Partial<GuildDatabase>);
}

function formatGuildCounts(guild: Partial<GuildDatabase>): string[] {
  return [
    `Members: ${safeArrayLength(guild.members)}`,
    `Matches: ${safeArrayLength(guild.matches)}`,
    `Performances: ${safeArrayLength(guild.performances)}`,
    `Import batches: ${safeArrayLength(guild.importBatches)}`,
  ];
}

function readPlanTitle(plan: Partial<TacticalPlan>): string {
  return plan.title?.trim() || 'Untitled plan';
}

function safeArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatReportLines(lines: string[]): string {
  return lines.join('\n');
}
