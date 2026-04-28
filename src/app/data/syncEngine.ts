import type { GuildDatabase, GuildMember, Player, PlayerStats, TacticalPlan } from '../../types/domain';
import { guildMemberFromPlayer, normalizeIgn } from './domainUtils';
import { normalizeGuildDatabase } from './guildRepository';
import { sanitizeTacticalPlan } from './planRepository';
import { playerStatsFromMemberStats, selectMemberStats } from './selectors';

export function ensureGuildForPlan(plan: TacticalPlan, existingGuild?: GuildDatabase): { plan: TacticalPlan; guild: GuildDatabase } {
  const now = new Date().toISOString();
  const sanitizedPlan = sanitizeTacticalPlan(plan);
  const guild = normalizeGuildDatabase(existingGuild);
  const members = [...guild.members];
  const membersById = new Map(members.map((member) => [member.id, member]));
  const membersByIgn = new Map(members.map((member) => [normalizeIgn(member.ign), member]));

  const roster = sanitizedPlan.roster.map((player) => {
    const existingMember =
      (player.memberId ? membersById.get(player.memberId) : undefined) ?? membersByIgn.get(normalizeIgn(player.ign));

    if (existingMember) {
      return { ...player, memberId: existingMember.id };
    }

    const member = guildMemberFromPlayer(player, 'Member', now);
    members.push(member);
    membersById.set(member.id, member);
    membersByIgn.set(normalizeIgn(member.ign), member);
    return { ...player, memberId: member.id };
  });

  const linkedGuild = {
    ...guild,
    members,
    updatedAt: now,
  };

  return {
    plan: syncPlanWithGuild({ ...sanitizedPlan, roster }, linkedGuild),
    guild: linkedGuild,
  };
}

export function syncPlanWithGuild(plan: TacticalPlan, guild: GuildDatabase): TacticalPlan {
  const memberById = new Map(guild.members.map((member) => [member.id, member]));
  const memberByIgn = new Map(guild.members.map((member) => [normalizeIgn(member.ign), member]));
  const statsByMemberId = new Map(selectMemberStats(guild).map((item) => [item.member.id, item]));
  let changed = false;

  const roster = plan.roster.map((player) => {
    const member = (player.memberId ? memberById.get(player.memberId) : undefined) ?? memberByIgn.get(normalizeIgn(player.ign));
    if (!member) {
      return player;
    }

    const syncedPlayer = syncPlayerSnapshot(player, member, statsByMemberId.get(member.id));
    if (!samePlayerSnapshot(player, syncedPlayer)) {
      changed = true;
    }

    return syncedPlayer;
  });

  if (!changed) {
    return plan;
  }

  return {
    ...plan,
    roster,
    updatedAt: new Date().toISOString(),
  };
}

function syncPlayerSnapshot(player: Player, member: GuildMember, stats?: ReturnType<typeof selectMemberStats>[number]): Player {
  return {
    ...player,
    memberId: member.id,
    ign: member.ign,
    alias: member.alias,
    role: member.role,
    teamId: member.teamId,
    party: member.party,
    notes: member.notes,
    stats: stats ? playerStatsFromMemberStats(stats) : player.stats ?? {},
  };
}

function samePlayerSnapshot(current: Player, next: Player): boolean {
  return (
    current.memberId === next.memberId &&
    current.ign === next.ign &&
    current.alias === next.alias &&
    current.role === next.role &&
    current.teamId === next.teamId &&
    current.party === next.party &&
    current.notes === next.notes &&
    sameStats(current.stats, next.stats)
  );
}

function sameStats(current?: PlayerStats, next?: PlayerStats): boolean {
  const currentStats = current ?? {};
  const nextStats = next ?? {};
  const keys: (keyof PlayerStats)[] = [
    'attendance',
    'defeated',
    'deaths',
    'assist',
    'lastPlayed',
    'dpsAvg',
    'healAvg',
    'tankAvg',
    'siegeAvg',
    'coinAvg',
  ];

  return keys.every((key) => currentStats[key] === nextStats[key]);
}
