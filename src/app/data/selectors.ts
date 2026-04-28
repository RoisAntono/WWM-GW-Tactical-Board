import { getMemberTeamLabel } from '../../shared/constants';
import type { GuildDatabase, GuildMember, GuildWarPerformance, Player, PlayerStats, TacticalPlan } from '../../types/domain';

export type GuildMemberStats = {
  member: GuildMember;
  totalMatches: number;
  lastPlayed?: string;
  totals: {
    defeated: number;
    deaths: number;
    assist: number;
    damage: number;
    tank: number;
    heal: number;
    siegeDamage: number;
    funCoin: number;
  };
  averages: {
    defeated: number;
    deaths: number;
    assist: number;
    damage: number;
    tank: number;
    heal: number;
    siegeDamage: number;
    funCoin: number;
  };
};

export type GuildMetric = 'damage' | 'tank' | 'heal' | 'siegeDamage' | 'funCoin';

export type PlanSquadItem = {
  player: Player;
  member?: GuildMember;
  stats?: GuildMemberStats;
};

export type AvailableMemberItem = {
  player: Player;
  member: GuildMember;
  stats: GuildMemberStats;
};

export type PlayerView = {
  player: Player;
  member?: GuildMember;
  stats?: GuildMemberStats;
};

export type RosterCsvRow = {
  IGN: string;
  Alias: string;
  Role: string;
  Team: string;
  Party: string;
  Attendance: number | '';
  Defeated: number | '';
  Assist: number | '';
  'Last Played': string;
  Damage: number | '';
  'Heal AVG': number | '';
  'Tank AVG': number | '';
  'Siege Damage': number | '';
  'Fun Coin': number | '';
  Notes: string;
};

export type MemberCsvRow = {
  IGN: string;
  Alias: string;
  Rank: string;
  Role: string;
  Team: string;
  Party: string;
  Status: string;
  Attendance: number;
  'Last Played': string;
  'Defeated AVG': number;
  'Assist AVG': number;
  'Deaths AVG': number;
  'Damage AVG': number;
  'Heal AVG': number;
  'Tank AVG': number;
  'Siege AVG': number;
  'Coin AVG': number;
  Notes: string;
};

export function selectMemberStats(guild: GuildDatabase): GuildMemberStats[] {
  const matchDateById = new Map(guild.matches.map((match) => [match.id, match.date]));
  const performancesByMember = new Map<string, GuildWarPerformance[]>();

  guild.performances.forEach((performance) => {
    const current = performancesByMember.get(performance.memberId) ?? [];
    current.push(performance);
    performancesByMember.set(performance.memberId, current);
  });

  return guild.members.map((member) => {
    const performances = performancesByMember.get(member.id) ?? [];
    const performanceMatches = performances.length;
    const summaryMatches = summaryAttendanceFrom(member.summary);
    const totalMatches = summaryMatches + performanceMatches;
    const performanceTotals = performances.reduce(
      (result, performance) => ({
        defeated: result.defeated + performance.defeated,
        deaths: result.deaths + (performance.deaths ?? 0),
        assist: result.assist + performance.assist,
        damage: result.damage + performance.damage,
        tank: result.tank + performance.tank,
        heal: result.heal + performance.heal,
        siegeDamage: result.siegeDamage + performance.siegeDamage,
        funCoin: result.funCoin + performance.funCoin,
      }),
      { defeated: 0, deaths: 0, assist: 0, damage: 0, tank: 0, heal: 0, siegeDamage: 0, funCoin: 0 },
    );
    const playedDates = performances
      .map((performance) => matchDateById.get(performance.matchId))
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => b.localeCompare(a));

    const summaryTotals = totalsFromSummary(member.summary);
    const totals = addTotals(summaryTotals, performanceTotals);
    const metricCounts = addMetricCounts(metricCountsFromSummary(member.summary, summaryMatches), performanceMatches);

    return {
      member,
      totalMatches,
      lastPlayed: playedDates[0] ?? member.summary?.lastPlayed,
      totals,
      averages: {
        defeated: average(totals.defeated, metricCounts.defeated),
        deaths: average(totals.deaths, metricCounts.deaths),
        assist: average(totals.assist, metricCounts.assist),
        damage: average(totals.damage, metricCounts.damage),
        tank: average(totals.tank, metricCounts.tank),
        heal: average(totals.heal, metricCounts.heal),
        siegeDamage: average(totals.siegeDamage, metricCounts.siegeDamage),
        funCoin: average(totals.funCoin, metricCounts.funCoin),
      },
    };
  });
}

export function selectPlanSquad(plan: TacticalPlan, guild: GuildDatabase): PlanSquadItem[] {
  const stats = selectMemberStats(guild);
  const statsByMemberId = new Map(stats.map((item) => [item.member.id, item]));
  const memberById = new Map(guild.members.map((member) => [member.id, member]));

  return plan.roster
    .map((player) => ({
      player,
      member: player.memberId ? memberById.get(player.memberId) : undefined,
      stats: player.memberId ? statsByMemberId.get(player.memberId) : undefined,
    }))
    .sort((a, b) => (b.stats?.totalMatches ?? 0) - (a.stats?.totalMatches ?? 0));
}

export function selectAvailableMembers(plan: TacticalPlan, guild: GuildDatabase): AvailableMemberItem[] {
  const planMemberIds = new Set(plan.roster.map((player) => player.memberId).filter(Boolean));
  return selectMemberStats(guild)
    .filter((item) => !planMemberIds.has(item.member.id))
    .sort((a, b) => b.totalMatches - a.totalMatches || (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? ''))
    .map((item) => ({
      player: playerPreviewFromMember(item.member),
      member: item.member,
      stats: item,
    }));
}

export function selectPlayerView(playerId: string | undefined, plan: TacticalPlan, guild: GuildDatabase): PlayerView | undefined {
  if (!playerId) {
    return undefined;
  }

  const player = plan.roster.find((item) => item.id === playerId);
  if (!player) {
    return undefined;
  }

  const stats = selectMemberStats(guild);
  const statsByMemberId = new Map(stats.map((item) => [item.member.id, item]));
  const member = player.memberId ? guild.members.find((item) => item.id === player.memberId) : undefined;
  return {
    player,
    member,
    stats: player.memberId ? statsByMemberId.get(player.memberId) : undefined,
  };
}

export function selectRosterCsvRows(plan: TacticalPlan, guild: GuildDatabase): RosterCsvRow[] {
  return selectPlanSquad(plan, guild).map(({ player, stats }) => {
    const playerStats = stats ? playerStatsFromMemberStats(stats) : player.stats;
    return {
      IGN: player.ign,
      Alias: player.alias ?? '',
      Role: player.role,
      Team: player.teamId ?? '',
      Party: player.party ?? '',
      Attendance: playerStats?.attendance ?? '',
      Defeated: playerStats?.defeated ?? '',
      Assist: playerStats?.assist ?? '',
      'Last Played': playerStats?.lastPlayed ?? '',
      Damage: playerStats?.dpsAvg ?? '',
      'Heal AVG': playerStats?.healAvg ?? '',
      'Tank AVG': playerStats?.tankAvg ?? '',
      'Siege Damage': playerStats?.siegeAvg ?? '',
      'Fun Coin': playerStats?.coinAvg ?? '',
      Notes: player.notes ?? '',
    };
  });
}

export function selectMemberCsvRows(rows: GuildMemberStats[]): MemberCsvRow[] {
  return rows.map((item) => ({
    IGN: item.member.ign,
    Alias: item.member.alias ?? '',
    Rank: item.member.rank,
    Role: item.member.memberRole,
    Team: getMemberTeamLabel(item.member.teamId),
    Party: item.member.party ?? '',
    Status: item.member.status,
    Attendance: item.totalMatches,
    'Last Played': item.lastPlayed ?? '',
    'Defeated AVG': item.averages.defeated,
    'Assist AVG': item.averages.assist,
    'Deaths AVG': item.averages.deaths,
    'Damage AVG': item.averages.damage,
    'Heal AVG': item.averages.heal,
    'Tank AVG': item.averages.tank,
    'Siege AVG': item.averages.siegeDamage,
    'Coin AVG': item.averages.funCoin,
    Notes: item.member.notes ?? '',
  }));
}

export function playerStatsFromMemberStats(item: GuildMemberStats): PlayerStats {
  return {
    attendance: item.totalMatches || undefined,
    defeated: item.averages.defeated || undefined,
    deaths: item.averages.deaths || undefined,
    assist: item.averages.assist || undefined,
    lastPlayed: item.lastPlayed,
    dpsAvg: item.averages.damage || undefined,
    healAvg: item.averages.heal || undefined,
    tankAvg: item.averages.tank || undefined,
    siegeAvg: item.averages.siegeDamage || undefined,
    coinAvg: item.averages.funCoin || undefined,
  };
}

export function getTopGuildMembers(stats: GuildMemberStats[], metric: GuildMetric, limit = 5): GuildMemberStats[] {
  return stats
    .filter((item) => item.averages[metric] > 0)
    .sort((a, b) => b.averages[metric] - a.averages[metric])
    .slice(0, limit);
}

export function countRecentlyActiveMembers(stats: GuildMemberStats[], recentMatches = 3): number {
  const recentMatchDates = Array.from(new Set(stats.map((item) => item.lastPlayed).filter(Boolean))).sort().slice(-recentMatches);
  const recentDateSet = new Set(recentMatchDates);
  return stats.filter((item) => item.lastPlayed && recentDateSet.has(item.lastPlayed)).length;
}

function playerPreviewFromMember(member: GuildMember): Player {
  return {
    id: member.id,
    memberId: member.id,
    ign: member.ign,
    alias: member.alias,
    role: member.role,
    teamId: member.teamId,
    party: member.party,
    notes: member.notes,
  };
}

function average(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

function totalsFromSummary(summary: GuildMember['summary']): GuildMemberStats['totals'] {
  const attendance = summaryAttendanceFrom(summary);
  return {
    defeated: (summary?.defeatedAvg ?? 0) * attendance,
    deaths: (summary?.deathsAvg ?? 0) * attendance,
    assist: (summary?.assistAvg ?? 0) * attendance,
    damage: (summary?.damageAvg ?? 0) * attendance,
    tank: (summary?.tankAvg ?? 0) * attendance,
    heal: (summary?.healAvg ?? 0) * attendance,
    siegeDamage: (summary?.siegeDamageAvg ?? 0) * attendance,
    funCoin: (summary?.funCoinAvg ?? 0) * attendance,
  };
}

function addTotals(
  first: GuildMemberStats['totals'],
  second: GuildMemberStats['totals'],
): GuildMemberStats['totals'] {
  return {
    defeated: first.defeated + second.defeated,
    deaths: first.deaths + second.deaths,
    assist: first.assist + second.assist,
    damage: first.damage + second.damage,
    tank: first.tank + second.tank,
    heal: first.heal + second.heal,
    siegeDamage: first.siegeDamage + second.siegeDamage,
    funCoin: first.funCoin + second.funCoin,
  };
}

type MetricCounts = Record<keyof GuildMemberStats['totals'], number>;

function metricCountsFromSummary(summary: GuildMember['summary'], attendance: number): MetricCounts {
  return {
    defeated: summary?.defeatedAvg !== undefined ? attendance : 0,
    deaths: summary?.deathsAvg !== undefined ? attendance : 0,
    assist: summary?.assistAvg !== undefined ? attendance : 0,
    damage: summary?.damageAvg !== undefined ? attendance : 0,
    tank: summary?.tankAvg !== undefined ? attendance : 0,
    heal: summary?.healAvg !== undefined ? attendance : 0,
    siegeDamage: summary?.siegeDamageAvg !== undefined ? attendance : 0,
    funCoin: summary?.funCoinAvg !== undefined ? attendance : 0,
  };
}

function addMetricCounts(summaryCounts: MetricCounts, performanceMatches: number): MetricCounts {
  return {
    defeated: summaryCounts.defeated + performanceMatches,
    deaths: summaryCounts.deaths + performanceMatches,
    assist: summaryCounts.assist + performanceMatches,
    damage: summaryCounts.damage + performanceMatches,
    tank: summaryCounts.tank + performanceMatches,
    heal: summaryCounts.heal + performanceMatches,
    siegeDamage: summaryCounts.siegeDamage + performanceMatches,
    funCoin: summaryCounts.funCoin + performanceMatches,
  };
}

function summaryAttendanceFrom(summary: GuildMember['summary']): number {
  return summary?.attendance ?? (hasSummaryStats(summary) ? 1 : 0);
}

function hasSummaryStats(summary: GuildMember['summary']): boolean {
  return (
    summary?.defeatedAvg !== undefined ||
    summary?.deathsAvg !== undefined ||
    summary?.assistAvg !== undefined ||
    summary?.damageAvg !== undefined ||
    summary?.tankAvg !== undefined ||
    summary?.healAvg !== undefined ||
    summary?.siegeDamageAvg !== undefined ||
    summary?.funCoinAvg !== undefined
  );
}

export function getRosterTeamLabel(teamId?: string): string {
  return getMemberTeamLabel(teamId);
}
