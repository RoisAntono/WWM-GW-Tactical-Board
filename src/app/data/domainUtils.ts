import {
  getMemberTeamId,
  getMemberTeamRole,
  isMemberRankOption,
  isMemberRoleOption,
  isMemberStatusOption,
  normalizeMemberRoleValue,
  objectiveLabels,
  roleConfigs,
} from '../../shared/constants';
import { createId } from '../../shared/id';
import type {
  Coordinate,
  GuildMember,
  GuildMemberSummary,
  ImportRow,
  MemberRank,
  MemberRole,
  MemberStatus,
  ObjectiveMarker,
  ObjectiveType,
  Player,
  Role,
  Route,
} from '../../types/domain';

export function normalizeDisplayIgn(ign: string): string {
  return String(ign ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeIgn(ign: string): string {
  return normalizeDisplayIgn(ign).toLowerCase();
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && value in roleConfigs;
}

export function isObjectiveType(value: unknown): value is ObjectiveType {
  return typeof value === 'string' && value in objectiveLabels;
}

export function isMemberStatus(value: unknown): value is MemberStatus {
  return isMemberStatusOption(value);
}

export function isMemberRank(value: unknown): value is MemberRank {
  return isMemberRankOption(value);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return isMemberRoleOption(value);
}

export function memberRoleFromTacticalRole(value: unknown): MemberRole {
  if (value === 'Support') {
    return 'Healer';
  }
  if (value === 'Defense') {
    return 'Tank';
  }
  if (value === 'Attack' || value === 'Splitpush' || value === 'Jungler') {
    return 'DPS';
  }
  return 'DPS';
}

export function normalizeMemberRoleInput(value: unknown, tacticalRole: unknown): MemberRole {
  return normalizeMemberRoleValue(value, memberRoleFromTacticalRole(tacticalRole));
}

export function rankFromStatus(value: unknown): MemberRank {
  if (value === 'Officer') {
    return 'Officer';
  }
  if (value === 'Core') {
    return 'Core';
  }
  if (value === 'Trial' || value === 'Pending Review') {
    return 'Trial';
  }
  if (value === 'Bench') {
    return 'Bench';
  }
  return 'Member';
}

export function createGuildMemberFromInput(input: Partial<GuildMember> & { ign: string }): GuildMember {
  const now = new Date().toISOString();
  const teamId = getMemberTeamId(input.teamId);
  const role = getMemberTeamRole(teamId) ?? (isRole(input.role) ? input.role : 'Flex');
  return {
    id: input.id || createId('member'),
    ign: normalizeDisplayIgn(String(input.ign ?? '')),
    alias: input.alias?.trim() || undefined,
    role,
    memberRole: normalizeMemberRoleInput(input.memberRole, role),
    teamId,
    party: input.party?.trim() || undefined,
    rank: isMemberRank(input.rank) ? input.rank : rankFromStatus(input.status),
    status: isMemberStatus(input.status) ? input.status : 'Member',
    summary: normalizeMemberSummary(input.summary),
    notes: input.notes?.trim() || undefined,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function guildMemberFromPlayer(player: Player, status: MemberStatus, timestamp: string): GuildMember {
  return createGuildMemberFromInput({
    id: player.memberId,
    ign: player.ign,
    alias: player.alias,
    role: player.role,
    memberRole: memberRoleFromTacticalRole(player.role),
    teamId: player.teamId,
    party: player.party,
    rank: status === 'Officer' ? 'Officer' : status === 'Core' ? 'Core' : status === 'Trial' ? 'Trial' : 'Member',
    status,
    notes: player.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function findMemberByIgn(members: GuildMember[], ign: string): GuildMember | undefined {
  const ignKey = normalizeIgn(ign);
  return members.find((member) => normalizeIgn(member.ign) === ignKey);
}

export function uniqueImportRowsByIgn(rows: ImportRow[]): ImportRow[] {
  const seenIgns = new Set<string>();
  return rows.filter((row) => {
    const ignKey = normalizeIgn(row.ign);
    if (!ignKey || seenIgns.has(ignKey)) {
      return false;
    }

    seenIgns.add(ignKey);
    return true;
  });
}

export function summaryFromImportRow(row: ImportRow): GuildMemberSummary | undefined {
  return normalizeMemberSummary({
    attendance: row.attendance,
    lastPlayed: row.lastPlayed,
    defeatedAvg: row.defeated,
    deathsAvg: row.deaths,
    assistAvg: row.assist,
    damageAvg: row.dpsAvg,
    tankAvg: row.tankAvg,
    healAvg: row.healAvg,
    siegeDamageAvg: row.siegeAvg,
    funCoinAvg: row.coinAvg,
  });
}

export function normalizeMemberSummary(summary: GuildMemberSummary | undefined): GuildMemberSummary | undefined {
  if (!summary) {
    return undefined;
  }

  const normalized = {
    attendance: optionalStat(summary.attendance),
    lastPlayed: summary.lastPlayed?.trim() || undefined,
    defeatedAvg: optionalStat(summary.defeatedAvg),
    deathsAvg: optionalStat(summary.deathsAvg),
    assistAvg: optionalStat(summary.assistAvg),
    damageAvg: optionalStat(summary.damageAvg),
    tankAvg: optionalStat(summary.tankAvg),
    healAvg: optionalStat(summary.healAvg),
    siegeDamageAvg: optionalStat(summary.siegeDamageAvg),
    funCoinAvg: optionalStat(summary.funCoinAvg),
  };

  const hasValue = Object.values(normalized).some((value) => value !== undefined && value !== '');
  return hasValue ? normalized : undefined;
}

export function optionalStat(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function statOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function normalizeCoordinate(position: Coordinate | undefined): Coordinate {
  return {
    x: clampCoordinate(position?.x),
    y: clampCoordinate(position?.y),
  };
}

export function normalizeMarkerPriority(value: unknown): 'low' | 'normal' | 'high' {
  return value === 'low' || value === 'high' ? value : 'normal';
}

export function normalizeRouteStyle(value: unknown): Route['style'] {
  return value === 'dashed' || value === 'fallback' ? value : 'solid';
}

export function normalizeObjectiveOwner(value: unknown): ObjectiveMarker['owner'] {
  return value === 'ally' || value === 'enemy' ? value : 'neutral';
}

export function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function clampCoordinate(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, numeric));
}
