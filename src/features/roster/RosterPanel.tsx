import { useMemo } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { selectAvailableMembers, selectPlanSquad, type GuildMemberStats } from '../../app/data/selectors';
import { usePlanStore } from '../../app/store';
import { getMemberTeamLabel, roleConfigs } from '../../shared/constants';
import { formatCompactNumber } from '../../shared/number';
import type { GuildMember, Player, Role } from '../../types/domain';

type RosterPanelProps = {
  onOpenMemberData: () => void;
  onQuickPlaceStart?: () => void;
};

export function RosterPanel({ onOpenMemberData, onQuickPlaceStart }: RosterPanelProps) {
  const {
    plan,
    guild,
    selectedPlayerId,
    activePhaseId,
    selectPlayer,
    addMemberToPlan,
    removePlayer,
    setTool,
  } = usePlanStore();

  void onOpenMemberData;

  const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
  const markerPlayerIds = new Set(activePhase?.playerMarkers.map((marker) => marker.playerId) ?? []);
  const squadPlayers = useMemo(() => selectPlanSquad(plan, guild), [guild, plan]);
  const memberList = useMemo(() => selectAvailableMembers(plan, guild), [guild, plan]);

  return (
    <aside className="panel roster-panel">
      <section className="roster-split-section">
        <SectionTitle title="Plan Squad" value={String(squadPlayers.length)} />
        <div className="player-list roster-section-list">
          {squadPlayers.map(({ player, member, stats }) => {
            const hasMarker = markerPlayerIds.has(player.id);
            return (
              <SquadRow
                key={player.id}
                player={player}
                member={member}
                stats={stats}
                hasMarker={hasMarker}
                isSelected={selectedPlayerId === player.id}
                onSelect={() => {
                  selectPlayer(player.id);
                  setTool(hasMarker ? 'select' : 'place-player');
                  onQuickPlaceStart?.();
                }}
                onRemove={() => removePlayer(player.id)}
              />
            );
          })}
        </div>
      </section>

      <section className="roster-split-section">
        <SectionTitle title="Member List" value={`${memberList.length} available`} />
        <div className="member-list roster-section-list">
          {memberList.map((item) => (
            <SquadRow
              key={item.member.id}
              player={item.player}
              member={item.member}
              stats={item.stats}
              hasMarker={false}
              isSelected={false}
              onSelect={() => {
                addMemberToPlan(item.member.id);
                setTool('place-player');
                onQuickPlaceStart?.();
              }}
              onRemove={undefined}
            />
          ))}
        </div>
      </section>
    </aside>
  );
}

function SquadRow({
  player,
  member,
  stats,
  hasMarker,
  isSelected,
  onSelect,
  onRemove,
}: {
  player: Player;
  member?: GuildMember;
  stats?: GuildMemberStats;
  hasMarker: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const role = getSafeRole(member?.role ?? player.role);
  const isPlanRow = Boolean(onRemove);
  return (
    <div className={`player-row roster-summary-row ${isSelected ? 'is-selected' : ''}`}>
      <button type="button" className="player-select roster-member-select" onClick={onSelect}>
        <span className="role-dot" style={{ backgroundColor: roleConfigs[role].color }} />
        <span className="player-main">
          <strong>{player.ign}</strong>
          <small>
            {member?.memberRole || 'DPS'} | {getMemberTeamLabel(member?.teamId)} | {member?.rank || 'Member'}
          </small>
        </span>
        <span className="roster-row-meta">
          {isPlanRow ? (
            <span className={`marker-state ${hasMarker ? 'is-set' : ''}`}>{hasMarker ? 'On Map' : 'Click Place'}</span>
          ) : (
            <span className="marker-state is-set">{stats?.totalMatches ?? 0} GW</span>
          )}
          <span className="roster-activity-chip">
            {isPlanRow ? `${stats?.totalMatches ?? 0} GW` : `${formatCompactNumber(stats?.averages.damage)} DMG`}
          </span>
        </span>
      </button>
      {onRemove ? (
        <button className="row-delete" onClick={onRemove} title={`Remove ${player.ign} from squad`} aria-label={`Remove ${player.ign} from squad`}>
          <Trash2 size={14} />
        </button>
      ) : (
        <button className="row-add" onClick={onSelect} title={`Add ${player.ign} to squad`} aria-label={`Add ${player.ign} to squad`}>
          <UserPlus size={14} />
        </button>
      )}
    </div>
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

function getSafeRole(role: unknown): Role {
  return typeof role === 'string' && role in roleConfigs ? (role as Role) : 'Flex';
}
