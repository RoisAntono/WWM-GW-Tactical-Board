import type { GuildMemberStats } from '../../app/data/selectors';

export type SortKey = 'activity' | 'lastPlayed' | 'damage' | 'tank' | 'heal' | 'siegeDamage' | 'ign';

export function compareMemberStats(a: GuildMemberStats, b: GuildMemberStats, sortKey: SortKey): number {
  if (sortKey === 'ign') {
    return a.member.ign.localeCompare(b.member.ign);
  }
  if (sortKey === 'activity') {
    return b.totalMatches - a.totalMatches || a.member.ign.localeCompare(b.member.ign);
  }
  if (sortKey === 'lastPlayed') {
    return (b.lastPlayed ?? '').localeCompare(a.lastPlayed ?? '') || b.totalMatches - a.totalMatches;
  }
  return b.averages[sortKey] - a.averages[sortKey] || b.totalMatches - a.totalMatches;
}
