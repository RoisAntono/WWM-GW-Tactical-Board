import {
  countRecentlyActiveMembers,
  getTopGuildMembers,
  type GuildMemberStats,
  type GuildMetric,
} from '../../app/data/selectors';
import { formatCompactNumber } from '../../shared/number';
import type { GuildDatabase } from '../../types/domain';

type MemberDataDashboardProps = {
  guild: GuildDatabase;
  stats: GuildMemberStats[];
  activeLatest: number;
};

export function MemberDataDashboard({ guild, stats, activeLatest }: MemberDataDashboardProps) {
  const latestImport = guild.importBatches[0];
  const latestImportDetail = latestImport
    ? latestImport.files?.length
      ? `${latestImport.source} ${latestImport.kind}, ${latestImport.files.length} files, ${latestImport.acceptedCount}/${latestImport.rowCount} rows`
      : `${latestImport.source} ${latestImport.kind}`
    : 'No import batch';
  const topDamage = getTopGuildMembers(stats, 'damage', 5);
  const topTank = getTopGuildMembers(stats, 'tank', 5);
  const topHeal = getTopGuildMembers(stats, 'heal', 5);
  const topSiege = getTopGuildMembers(stats, 'siegeDamage', 5);
  const mostActive = [...stats].sort((a, b) => b.totalMatches - a.totalMatches).slice(0, 5);

  return (
    <section className="member-dashboard-grid">
      <DashboardCard label="Members" value={String(guild.members.length)} detail={`${activeLatest} active in latest match`} />
      <DashboardCard label="Matches" value={String(guild.matches.length)} detail={`${guild.performances.length} performance rows`} />
      <DashboardCard label="Recently Active" value={String(countRecentlyActiveMembers(stats, 3))} detail="Last 3 match dates" />
      <DashboardCard label="Pending Review" value={String(guild.members.filter((member) => member.status === 'Pending Review').length)} detail="Needs cleanup" />
      <DashboardCard label="Imports" value={String(guild.importBatches.length)} detail={latestImportDetail} />
      <LeaderCard title="Most Active" items={mostActive} metric="activity" />
      <LeaderCard title="Top Damage" items={topDamage} metric="damage" />
      <LeaderCard title="Top Tank" items={topTank} metric="tank" />
      <LeaderCard title="Top Heal" items={topHeal} metric="heal" />
      <LeaderCard title="Top Siege" items={topSiege} metric="siegeDamage" />
    </section>
  );
}

function DashboardCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="member-dashboard-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function LeaderCard({
  title,
  items,
  metric,
}: {
  title: string;
  items: GuildMemberStats[];
  metric: GuildMetric | 'activity';
}) {
  return (
    <div className="member-leader-card">
      <strong>{title}</strong>
      {items.length ? (
        items.map((item) => (
          <span key={item.member.id}>
            {item.member.ign}
            <b>{metric === 'activity' ? item.totalMatches : formatCompactNumber(item.averages[metric])}</b>
          </span>
        ))
      ) : (
        <span>-</span>
      )}
    </div>
  );
}
