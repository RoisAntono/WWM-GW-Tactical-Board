import { Crosshair, MapPin, Route, Trash2, UserRound } from 'lucide-react';
import { selectPlayerView } from '../../app/data/selectors';
import { usePlanStore } from '../../app/store';
import { getMemberTeamId, getMemberTeamLabel, getMemberTeamRole, memberRoleOrder, memberTeamOptions, objectiveLabels, roleConfigs } from '../../shared/constants';
import { formatCompactNumber } from '../../shared/number';
import type { MemberRole, Role } from '../../types/domain';
import { mapSize } from '../board/boardMath';

export function InspectorPanel() {
  const {
    plan,
    guild,
    activePhaseId,
    selectedPlayerId,
    selectedRouteId,
    selectedObjectiveId,
    selectedNoteId,
    updatePlayer,
    updateGuildMember,
    updateMarkerTask,
    movePlayerMarker,
    moveObjective,
    updateNote,
    removeSelected,
  } = usePlanStore();

  const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
  const selectedPlayerView = selectPlayerView(selectedPlayerId, plan, guild);
  const selectedPlayer = selectedPlayerView?.player;
  const selectedMember = selectedPlayerView?.member;
  const selectedMarker = activePhase?.playerMarkers.find((marker) => marker.playerId === selectedPlayerId);
  const selectedRoute = activePhase?.routes.find((route) => route.id === selectedRouteId);
  const selectedObjective = activePhase?.objectives.find((objective) => objective.id === selectedObjectiveId);
  const selectedNote = activePhase?.notes.find((note) => note.id === selectedNoteId);

  return (
    <aside className="panel inspector-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{selectedPlayer ? selectedPlayer.ign : selectedRoute ? selectedRoute.name : selectedObjective ? selectedObjective.label : 'No Selection'}</h2>
        </div>
        <Crosshair size={20} />
      </div>

      {selectedPlayer ? (
        <div className="inspector-section">
          <div className="section-title">
            <UserRound size={16} />
            Player Detail
          </div>
          <label>
            IGN
            <input value={selectedPlayer.ign} onChange={(event) => updatePlayer(selectedPlayer.id, { ign: event.target.value })} />
          </label>
          <label>
            Alias
            <input
              value={selectedPlayer.alias ?? ''}
              onChange={(event) => updatePlayer(selectedPlayer.id, { alias: event.target.value })}
            />
          </label>
          <label>
            Combat Role
            <select
              value={selectedMember?.memberRole ?? 'DPS'}
              disabled={!selectedMember}
              onChange={(event) =>
                selectedMember && updateGuildMember(selectedMember.id, { memberRole: event.target.value as MemberRole })
              }
            >
              {memberRoleOrder.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tactical Team
            <select
              value={getMemberTeamId(selectedPlayer.teamId) ?? selectedPlayer.teamId ?? ''}
              onChange={(event) => {
                const teamId = event.target.value || undefined;
                updatePlayer(selectedPlayer.id, {
                  teamId,
                  role: getMemberTeamRole(teamId) ?? ('Flex' as Role),
                });
              }}
            >
              <option value="">Unassigned</option>
              {selectedPlayer.teamId && !getMemberTeamId(selectedPlayer.teamId) ? (
                <option value={selectedPlayer.teamId}>{getMemberTeamLabel(selectedPlayer.teamId)}</option>
              ) : null}
              {memberTeamOptions.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Party
            <input
              value={selectedPlayer.party ?? ''}
              onChange={(event) => updatePlayer(selectedPlayer.id, { party: event.target.value })}
            />
          </label>
          <label>
            Phase Task
            <textarea
              value={selectedMarker?.task ?? ''}
              onChange={(event) => selectedMarker && updateMarkerTask(selectedMarker.id, event.target.value)}
              placeholder="Current phase assignment"
            />
          </label>
          {selectedMarker ? (
            <CoordinateEditor
              x={selectedMarker.position.x}
              y={selectedMarker.position.y}
              onChange={(position) => movePlayerMarker(selectedMarker.id, position)}
            />
          ) : null}
          <label>
            Notes
            <textarea
              value={selectedPlayer.notes ?? ''}
              onChange={(event) => updatePlayer(selectedPlayer.id, { notes: event.target.value })}
            />
          </label>

          <div className="stat-list">
            <StatLine label="Combat Role" value={selectedMember?.memberRole ?? 'DPS'} />
            <StatLine label="Tactical Team" value={getMemberTeamLabel(selectedPlayer.teamId)} />
            <StatLine label="Defeated AVG" value={formatCompactNumber(selectedPlayer.stats?.defeated)} />
            <StatLine label="Assist" value={formatCompactNumber(selectedPlayer.stats?.assist)} />
            <StatLine label="Deaths AVG" value={formatCompactNumber(selectedPlayer.stats?.deaths)} />
            <StatLine label="Damage" value={formatCompactNumber(selectedPlayer.stats?.dpsAvg)} />
            <StatLine label="Heal AVG" value={formatCompactNumber(selectedPlayer.stats?.healAvg)} />
            <StatLine label="Tank AVG" value={formatCompactNumber(selectedPlayer.stats?.tankAvg)} />
            <StatLine label="Siege Damage" value={formatCompactNumber(selectedPlayer.stats?.siegeAvg)} />
            <StatLine label="Fun Coin" value={formatCompactNumber(selectedPlayer.stats?.coinAvg)} />
          </div>
        </div>
      ) : null}

      {selectedRoute ? (
        <div className="inspector-section">
          <div className="section-title">
            <Route size={16} />
            Route
          </div>
          <StatLine label="Role" value={selectedRoute.role} color={roleConfigs[selectedRoute.role].color} />
          <StatLine label="Points" value={String(selectedRoute.points.length)} />
          <StatLine label="Style" value={selectedRoute.style} />
        </div>
      ) : null}

      {selectedObjective ? (
        <div className="inspector-section">
          <div className="section-title">
            <MapPin size={16} />
            Objective
          </div>
          <StatLine label="Type" value={objectiveLabels[selectedObjective.type]} />
          <StatLine label="Owner" value={selectedObjective.owner} />
          <CoordinateEditor
            x={selectedObjective.position.x}
            y={selectedObjective.position.y}
            onChange={(position) => moveObjective(selectedObjective.id, position)}
          />
        </div>
      ) : null}

      {selectedNote ? (
        <div className="inspector-section">
          <div className="section-title">
            <MapPin size={16} />
            Map Note
          </div>
          <label>
            Text
            <textarea value={selectedNote.text} onChange={(event) => updateNote(selectedNote.id, event.target.value)} />
          </label>
        </div>
      ) : null}

      {!selectedPlayer && !selectedRoute && !selectedObjective && !selectedNote ? (
        <div className="empty-state">
          Select a dot, route, objective, or note on the map. Hovering a dot shows the player tooltip.
        </div>
      ) : (
        <button className="danger-button" onClick={removeSelected}>
          <Trash2 size={15} />
          Remove Selection
        </button>
      )}
    </aside>
  );
}

function StatLine({ label, value, color }: { label: string; value?: string; color?: string }) {
  return (
    <div className="stat-line">
      <span>{label}</span>
      <strong style={color ? { color } : undefined}>{value || '-'}</strong>
    </div>
  );
}

function CoordinateEditor({
  x,
  y,
  onChange,
}: {
  x: number;
  y: number;
  onChange: (position: { x: number; y: number }) => void;
}) {
  const update = (axis: 'x' | 'y', value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    onChange({
      x: axis === 'x' ? clamp(parsed) : x,
      y: axis === 'y' ? clamp(parsed) : y,
    });
  };

  return (
    <div className="coordinate-editor">
      <div className="section-title">Coordinates</div>
      <div className="coordinate-grid">
        <label>
          X
          <input type="number" min="0" max="1" step="0.001" value={x.toFixed(3)} onChange={(event) => update('x', event.target.value)} />
        </label>
        <label>
          Y
          <input type="number" min="0" max="1" step="0.001" value={y.toFixed(3)} onChange={(event) => update('y', event.target.value)} />
        </label>
      </div>
      <div className="coordinate-pixels">
        Pixel {Math.round(x * mapSize.width)}, {Math.round(y * mapSize.height)}
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
