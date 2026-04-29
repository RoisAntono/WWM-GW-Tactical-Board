import { Search, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { selectAvailableMembers, selectPlanSquad, type GuildMemberStats } from '../../app/data/selectors';
import { usePlanStore } from '../../app/store';
import { getMemberTeamLabel, roleConfigs } from '../../shared/constants';
import { formatCompactNumber } from '../../shared/number';
import type { GuildMember, Player, Role } from '../../types/domain';

export function CompactSquadPicker() {
  const [query, setQuery] = useState('');
  const {
    plan,
    guild,
    selectedPlayerId,
    activePhaseId,
    selectPlayer,
    addMemberToPlan,
    setTool,
  } = usePlanStore();

  const normalizedQuery = query.trim().toLowerCase();
  const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
  const markerPlayerIds = new Set(activePhase?.playerMarkers.map((marker) => marker.playerId) ?? []);
  const squadPlayers = useMemo(() => selectPlanSquad(plan, guild), [guild, plan]);
  const memberList = useMemo(() => selectAvailableMembers(plan, guild), [guild, plan]);

  const filteredSquad = useMemo(
    () => squadPlayers.filter(({ player, member }) => matchesQuery(player.ign, member, normalizedQuery)),
    [normalizedQuery, squadPlayers],
  );
  const filteredMembers = useMemo(
    () => memberList.filter(({ player, member }) => matchesQuery(player.ign, member, normalizedQuery)),
    [memberList, normalizedQuery],
  );

  return (
    <aside className="panel compact-squad-picker">
      <div className="compact-picker-heading">
        <div>
          <p className="eyebrow">Focus Squad</p>
          <h2>Place Players</h2>
        </div>
        <UsersRound size={17} />
      </div>
      <label className="compact-picker-search">
        <Search size={15} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search squad or members" />
      </label>

      <section className="compact-picker-section">
        <SectionTitle title="Plan Squad" value={String(filteredSquad.length)} />
        <div className="compact-picker-list">
          {filteredSquad.map(({ player, member, stats }) => {
            const hasMarker = markerPlayerIds.has(player.id);
            return (
              <CompactSquadRow
                key={player.id}
                player={player}
                member={member}
                stats={stats}
                hasMarker={hasMarker}
                selected={selectedPlayerId === player.id}
                onSelect={() => {
                  selectPlayer(player.id);
                  setTool(hasMarker ? 'select' : 'place-player');
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="compact-picker-section">
        <SectionTitle title="Available" value={String(filteredMembers.length)} />
        <div className="compact-picker-list">
          {filteredMembers.map(({ player, member, stats }) => (
            <CompactSquadRow
              key={member.id}
              player={player}
              member={member}
              stats={stats}
              hasMarker={false}
              selected={false}
              onSelect={() => {
                addMemberToPlan(member.id);
                setTool('place-player');
              }}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function CompactSquadRow({
  player,
  member,
  stats,
  hasMarker,
  selected,
  onSelect,
}: {
  player: Player;
  member?: GuildMember;
  stats?: GuildMemberStats;
  hasMarker: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const role = getSafeRole(member?.role ?? player.role);

  return (
    <button type="button" className={`compact-squad-row ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <span className="role-dot" style={{ backgroundColor: roleConfigs[role].color }} />
      <span className="player-main">
        <strong>{player.ign}</strong>
        <small>
          {member?.memberRole || 'DPS'} | {getMemberTeamLabel(member?.teamId)}
        </small>
      </span>
      <span className="compact-row-meta">
        <span className={`marker-state ${hasMarker ? 'is-set' : ''}`}>{hasMarker ? 'On Map' : 'Click Place'}</span>
        <span>{formatCompactNumber(stats?.averages.damage)} DMG</span>
      </span>
    </button>
  );
}

function SectionTitle({ title, value }: { title: string; value: string }) {
  return (
    <div className="roster-section-title">
      <span>{title}</span>
      <small>{value}</small>
    </div>
  );
}

function matchesQuery(ign: string, member: GuildMember | undefined, query: string): boolean {
  if (!query) {
    return true;
  }

  return [ign, member?.alias, member?.teamId, member?.rank, member?.memberRole]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function getSafeRole(role: unknown): Role {
  return typeof role === 'string' && role in roleConfigs ? (role as Role) : 'Flex';
}
