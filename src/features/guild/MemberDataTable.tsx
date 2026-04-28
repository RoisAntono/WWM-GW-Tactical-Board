import { Trash2 } from 'lucide-react';
import type { GuildMemberStats } from '../../app/data/selectors';
import { getMemberTeamLabel, memberRankOptions, memberRoleOrder, memberStatusOptions, memberTeamOptions } from '../../shared/constants';
import { formatCompactNumber } from '../../shared/number';
import type { GuildMember, MemberRank, MemberRole, MemberStatus } from '../../types/domain';

type MemberDataTableProps = {
  rows: GuildMemberStats[];
  updateGuildMember: (memberId: string, patch: Partial<GuildMember>) => void;
  onDeleteRequest: (member: GuildMember) => void;
};

export function MemberDataTable({ rows, updateGuildMember, onDeleteRequest }: MemberDataTableProps) {
  return (
    <section className="member-table-panel">
      <div className="member-table-wrap">
        <table className="member-data-table">
          <thead>
            <tr>
              <th>IGN</th>
              <th>Alias</th>
              <th>Rank</th>
              <th>Role</th>
              <th>Team</th>
              <th>Party</th>
              <th>Status</th>
              <th>Attendance</th>
              <th>Last Played</th>
              <th>Defeated AVG</th>
              <th>Assist AVG</th>
              <th>Deaths AVG</th>
              <th>Damage AVG</th>
              <th>Heal AVG</th>
              <th>Tank AVG</th>
              <th>Siege AVG</th>
              <th>Coin AVG</th>
              <th>Notes</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <MemberTableRow
                key={item.member.id}
                item={item}
                updateGuildMember={updateGuildMember}
                onDeleteRequest={onDeleteRequest}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MemberTableRow({
  item,
  updateGuildMember,
  onDeleteRequest,
}: {
  item: GuildMemberStats;
  updateGuildMember: (memberId: string, patch: Partial<GuildMember>) => void;
  onDeleteRequest: (member: GuildMember) => void;
}) {
  const { member, totalMatches, lastPlayed, averages } = item;
  return (
    <tr>
      <td className="member-ign-cell">
        <strong>{member.ign}</strong>
      </td>
      <td>
        <input value={member.alias ?? ''} onChange={(event) => updateGuildMember(member.id, { alias: event.target.value })} />
      </td>
      <td>
        <select value={member.rank} onChange={(event) => updateGuildMember(member.id, { rank: event.target.value as MemberRank })}>
          {memberRankOptions.map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={member.memberRole} onChange={(event) => updateGuildMember(member.id, { memberRole: event.target.value as MemberRole })}>
          {memberRoleOrder.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select value={member.teamId ?? ''} onChange={(event) => updateGuildMember(member.id, { teamId: event.target.value || undefined })}>
          <option value="">No Team</option>
          {member.teamId && !memberTeamOptions.some((team) => team.id === member.teamId) ? (
            <option value={member.teamId}>{getMemberTeamLabel(member.teamId)}</option>
          ) : null}
          {memberTeamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input value={member.party ?? ''} onChange={(event) => updateGuildMember(member.id, { party: event.target.value })} />
      </td>
      <td>
        <select value={member.status} onChange={(event) => updateGuildMember(member.id, { status: event.target.value as MemberStatus })}>
          {memberStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </td>
      <td>{totalMatches}</td>
      <td>{lastPlayed ?? '-'}</td>
      <td>{formatCompactNumber(averages.defeated)}</td>
      <td>{formatCompactNumber(averages.assist)}</td>
      <td>{formatCompactNumber(averages.deaths)}</td>
      <td>{formatCompactNumber(averages.damage)}</td>
      <td>{formatCompactNumber(averages.heal)}</td>
      <td>{formatCompactNumber(averages.tank)}</td>
      <td>{formatCompactNumber(averages.siegeDamage)}</td>
      <td>{formatCompactNumber(averages.funCoin)}</td>
      <td>
        <input value={member.notes ?? ''} onChange={(event) => updateGuildMember(member.id, { notes: event.target.value })} />
      </td>
      <td>
        <button
          className="row-delete"
          onClick={() => onDeleteRequest(member)}
          title={`Delete ${member.ign}`}
          aria-label={`Delete ${member.ign}`}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
