import { Plus, Search } from 'lucide-react';
import { memberRankOptions, memberRoleOrder, memberStatusOptions } from '../../shared/constants';
import type { MemberRank, MemberRole, MemberStatus } from '../../types/domain';
import { MatchDateTimePicker } from './MatchDateTimePicker';
import type { SortKey } from './memberDataSorting';

type MemberDataToolbarProps = {
  filter: string;
  onFilterChange: (value: string) => void;
  roleFilter: MemberRole | 'All';
  onRoleFilterChange: (value: MemberRole | 'All') => void;
  rankFilter: MemberRank | 'All';
  onRankFilterChange: (value: MemberRank | 'All') => void;
  statusFilter: MemberStatus | 'All';
  onStatusFilterChange: (value: MemberStatus | 'All') => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  newIgn: string;
  onNewIgnChange: (value: string) => void;
  onAddMember: () => void;
  matchDate: string;
  matchTime: string;
  onMatchDateChange: (value: string) => void;
  onMatchTimeChange: (value: string) => void;
  matchOpponent: string;
  onMatchOpponentChange: (value: string) => void;
};

export function MemberDataToolbar({
  filter,
  onFilterChange,
  roleFilter,
  onRoleFilterChange,
  rankFilter,
  onRankFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortKeyChange,
  newIgn,
  onNewIgnChange,
  onAddMember,
  matchDate,
  matchTime,
  onMatchDateChange,
  onMatchTimeChange,
  matchOpponent,
  onMatchOpponentChange,
}: MemberDataToolbarProps) {
  return (
    <section className="member-data-tools">
      <label className="search-field">
        <Search size={15} />
        <input placeholder="Search IGN, alias, team" value={filter} onChange={(event) => onFilterChange(event.target.value)} />
      </label>
      <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as MemberRole | 'All')}>
        <option value="All">All Roles</option>
        {memberRoleOrder.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <select value={rankFilter} onChange={(event) => onRankFilterChange(event.target.value as MemberRank | 'All')}>
        <option value="All">All Ranks</option>
        {memberRankOptions.map((rank) => (
          <option key={rank} value={rank}>
            {rank}
          </option>
        ))}
      </select>
      <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as MemberStatus | 'All')}>
        <option value="All">All Status</option>
        {memberStatusOptions.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <select value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as SortKey)}>
        <option value="activity">Sort: Activity</option>
        <option value="lastPlayed">Sort: Last Played</option>
        <option value="damage">Sort: Damage</option>
        <option value="tank">Sort: Tank</option>
        <option value="heal">Sort: Heal</option>
        <option value="siegeDamage">Sort: Siege</option>
        <option value="ign">Sort: IGN</option>
      </select>
      <div className="member-add-inline">
        <input placeholder="New member IGN" value={newIgn} onChange={(event) => onNewIgnChange(event.target.value)} />
        <button className="icon-button" onClick={onAddMember} title="Add member" aria-label="Add member">
          <Plus size={16} />
        </button>
      </div>
      <div className="match-inline-meta">
        <MatchDateTimePicker
          date={matchDate}
          time={matchTime}
          onDateChange={onMatchDateChange}
          onTimeChange={onMatchTimeChange}
          label="Match Timestamp"
        />
        <input value={matchOpponent} onChange={(event) => onMatchOpponentChange(event.target.value)} placeholder="Match opponent" aria-label="Match opponent" />
      </div>
    </section>
  );
}
