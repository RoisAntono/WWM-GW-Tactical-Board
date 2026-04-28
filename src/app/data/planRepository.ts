import { getMemberTeamId, getMemberTeamRole, objectiveLabels, roleConfigs } from '../../shared/constants';
import { createId } from '../../shared/id';
import { createDefaultPlan } from '../../features/strategy/defaultPlan';
import type { Coordinate, GuildMember, ImportRow, Phase, Player, Role, TacticalPlan, Team } from '../../types/domain';
import {
  isObjectiveType,
  isRole,
  normalizeCoordinate,
  normalizeDisplayIgn,
  normalizeIgn,
  normalizeMarkerPriority,
  normalizeObjectiveOwner,
  normalizeRouteStyle,
  uniqueIds,
} from './domainUtils';

export function sanitizeTacticalPlan(plan: TacticalPlan): TacticalPlan {
  const fallbackPlan = createDefaultPlan();
  const sourceRoster = Array.isArray(plan.roster) ? plan.roster : [];
  const sourceTeams = Array.isArray(plan.teams) ? plan.teams : fallbackPlan.teams;
  const sourcePhases = Array.isArray(plan.phases) && plan.phases.length > 0 ? plan.phases : fallbackPlan.phases;
  const playerIdMap = new Map<string, string>();
  const roster: Player[] = [];
  const seenIgns = new Map<string, Player>();

  sourceRoster.forEach((player) => {
    const ign = normalizeDisplayIgn(String(player.ign ?? ''));
    const ignKey = normalizeIgn(ign);
    if (!ignKey) {
      return;
    }

    const playerId = player.id || createId('player');
    const existingPlayer = seenIgns.get(ignKey);
    if (existingPlayer) {
      playerIdMap.set(playerId, existingPlayer.id);
      return;
    }

    const normalizedTeamId = getMemberTeamId(player.teamId) ?? player.teamId;
    const normalizedPlayer: Player = {
      ...player,
      id: playerId,
      ign,
      role: getMemberTeamRole(normalizedTeamId) ?? (isRole(player.role) ? player.role : 'Flex'),
      teamId: normalizedTeamId,
      stats: player.stats && typeof player.stats === 'object' ? player.stats : {},
    };
    roster.push(normalizedPlayer);
    seenIgns.set(ignKey, normalizedPlayer);
    playerIdMap.set(playerId, playerId);
  });

  const rosterIds = new Set(roster.map((player) => player.id));
  const teams = sourceTeams.map((team) => {
    const role = isRole(team.role) ? team.role : 'Flex';
    return {
      ...team,
      id: team.id || createId('team'),
      name: team.name || role,
      role,
      color: team.color || roleConfigs[role].color,
    };
  });
  const phases = sourcePhases.map((phase, index) => {
    const playerMarkers = Array.isArray(phase.playerMarkers) ? phase.playerMarkers : [];
    const routes = Array.isArray(phase.routes) ? phase.routes : [];
    const objectives = Array.isArray(phase.objectives) ? phase.objectives : [];
    const zones = Array.isArray(phase.zones) ? phase.zones : [];
    const notes = Array.isArray(phase.notes) ? phase.notes : [];

    return {
      ...phase,
      id: phase.id || createId('phase'),
      name: phase.name || fallbackPlan.phases[index]?.name || `Phase ${index + 1}`,
      playerMarkers: uniqueMarkersByPlayer(
        playerMarkers
          .map((marker) => ({
            ...marker,
            id: marker.id || createId('marker'),
            playerId: playerIdMap.get(marker.playerId) ?? marker.playerId,
            position: normalizeCoordinate(marker.position),
            priority: normalizeMarkerPriority(marker.priority),
          }))
          .filter((marker) => rosterIds.has(marker.playerId)),
      ),
      routes: routes.map((route) => ({
        ...route,
        id: route.id || createId('route'),
        name: route.name || 'Route',
        role: isRole(route.role) ? route.role : 'Flex',
        points: Array.isArray(route.points) ? route.points.map(normalizeCoordinate) : [],
        style: normalizeRouteStyle(route.style),
        assignedPlayerIds: uniqueIds(
          (Array.isArray(route.assignedPlayerIds) ? route.assignedPlayerIds : [])
            .map((playerId) => playerIdMap.get(playerId) ?? playerId)
            .filter((playerId) => rosterIds.has(playerId)),
        ),
      })),
      objectives: objectives
        .filter((objective) => isObjectiveType(objective.type))
        .map((objective) => ({
          ...objective,
          id: objective.id || createId('objective'),
          label: objective.label || objectiveLabels[objective.type],
          position: normalizeCoordinate(objective.position),
          owner: normalizeObjectiveOwner(objective.owner),
        })),
      zones: zones.map((zone) => ({
        ...zone,
        id: zone.id || createId('zone'),
        name: zone.name || 'Zone',
        role: isRole(zone.role) ? zone.role : 'Flex',
        points: Array.isArray(zone.points) ? zone.points.map(normalizeCoordinate) : [],
        opacity: Number.isFinite(zone.opacity) ? Math.min(1, Math.max(0, Number(zone.opacity))) : 0.2,
      })),
      notes: notes.map((note) => ({
        ...note,
        id: note.id || createId('note'),
        text: String(note.text ?? ''),
        position: normalizeCoordinate(note.position),
      })),
    };
  });

  return {
    ...plan,
    version: 1,
    id: plan.id || fallbackPlan.id,
    title: plan.title || fallbackPlan.title,
    opponent: plan.opponent ?? '',
    roster,
    teams,
    phases,
    updatedAt: new Date().toISOString(),
  };
}

export function getSafeActivePhaseId(plan: TacticalPlan, preferredPhaseId?: string): string {
  if (preferredPhaseId && plan.phases.some((phase) => phase.id === preferredPhaseId)) {
    return preferredPhaseId;
  }

  return plan.phases[0]?.id ?? '';
}

export function createPlayerFromGuildMember(member: GuildMember): Player {
  return {
    id: createId('player'),
    memberId: member.id,
    ign: member.ign,
    alias: member.alias,
    role: member.role,
    teamId: member.teamId,
    party: member.party,
    stats: {},
    notes: member.notes,
  };
}

export function createPlayerFromImportRow(row: ImportRow, teams: Team[], memberId?: string): Player {
  const normalizedTeamId = getMemberTeamId(row.team);
  const matchedTeam = normalizedTeamId
    ? teams.find((team) => team.id === normalizedTeamId)
    : row.team
      ? teams.find((team) => team.name.toLowerCase() === row.team?.toLowerCase() || team.id === row.team)
      : undefined;

  return {
    id: createId('player'),
    memberId,
    ign: row.ign.trim(),
    alias: row.alias?.trim() || undefined,
    role: row.role ?? getMemberTeamRole(normalizedTeamId) ?? matchedTeam?.role ?? 'Flex',
    teamId: normalizedTeamId ?? matchedTeam?.id,
    party: row.party?.trim() || undefined,
    stats: {
      attendance: row.attendance,
      defeated: row.defeated ?? row.attendance,
      deaths: row.deaths,
      assist: row.assist,
      lastPlayed: row.lastPlayed,
      dpsAvg: row.dpsAvg,
      healAvg: row.healAvg,
      tankAvg: row.tankAvg,
      siegeAvg: row.siegeAvg,
      coinAvg: row.coinAvg,
    },
    notes: row.notes?.trim() || undefined,
  };
}

export function removeMemberFromPlan(plan: TacticalPlan, memberId: string): { plan: TacticalPlan; removedPlayerIds: string[] } {
  const removedPlayerIds = plan.roster.filter((player) => player.memberId === memberId).map((player) => player.id);
  const removedPlayerIdSet = new Set(removedPlayerIds);

  return {
    removedPlayerIds,
    plan: {
      ...plan,
      roster: plan.roster.filter((player) => player.memberId !== memberId),
      phases: plan.phases.map((phase) => ({
        ...phase,
        playerMarkers: phase.playerMarkers.filter((marker) => !removedPlayerIdSet.has(marker.playerId)),
        routes: phase.routes.map((route) => ({
          ...route,
          assignedPlayerIds: route.assignedPlayerIds.filter((playerId) => !removedPlayerIdSet.has(playerId)),
        })),
      })),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function removePlayerFromPlan(plan: TacticalPlan, playerId: string): TacticalPlan {
  return {
    ...plan,
    roster: plan.roster.filter((player) => player.id !== playerId),
    phases: plan.phases.map((phase) => ({
      ...phase,
      playerMarkers: phase.playerMarkers.filter((marker) => marker.playerId !== playerId),
      routes: phase.routes.map((route) => ({
        ...route,
        assignedPlayerIds: route.assignedPlayerIds.filter((assignedPlayerId) => assignedPlayerId !== playerId),
      })),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function mergePlayers(existing: Player[], incoming: Player[]): Player[] {
  const players = uniquePlayersByIgn(existing);
  const seenIgns = new Set(players.map((player) => normalizeIgn(player.ign)));

  incoming.forEach((player) => {
    const ignKey = normalizeIgn(player.ign);
    if (!ignKey || seenIgns.has(ignKey)) {
      return;
    }

    seenIgns.add(ignKey);
    players.push(player);
  });

  return players;
}

export function uniquePlayersByIgn(players: Player[]): Player[] {
  const seenIgns = new Set<string>();
  return players.filter((player) => {
    const ignKey = normalizeIgn(player.ign);
    if (!ignKey || seenIgns.has(ignKey)) {
      return false;
    }

    seenIgns.add(ignKey);
    return true;
  });
}

export function ensureMarkersForRoster(phase: Phase, roster: Player[], baseIndex: number): Phase['playerMarkers'] {
  const rosterIds = new Set(roster.map((player) => player.id));
  const validMarkers = uniqueMarkersByPlayer(phase.playerMarkers.filter((marker) => rosterIds.has(marker.playerId)));
  const markerPlayerIds = new Set(validMarkers.map((marker) => marker.playerId));
  const missingPlayers = roster.filter((player) => !markerPlayerIds.has(player.id));
  const missingMarkers = missingPlayers.map((player, index) => ({
    id: createId('marker'),
    playerId: player.id,
    position: defaultMarkerPosition(baseIndex + index),
    task: `Assign ${player.role} task`,
    priority: player.role === 'Shotcaller' ? ('high' as const) : ('normal' as const),
  }));

  return [...validMarkers, ...missingMarkers];
}

export function updatePhaseInPlan(plan: TacticalPlan, phaseId: string, updater: (phase: Phase) => Phase): TacticalPlan {
  return {
    ...plan,
    phases: plan.phases.map((phase) => (phase.id === phaseId ? updater(phase) : phase)),
    updatedAt: new Date().toISOString(),
  };
}

function uniqueMarkersByPlayer(markers: Phase['playerMarkers']): Phase['playerMarkers'] {
  const seenPlayerIds = new Set<string>();
  return markers.filter((marker) => {
    if (seenPlayerIds.has(marker.playerId)) {
      return false;
    }

    seenPlayerIds.add(marker.playerId);
    return true;
  });
}

function defaultMarkerPosition(index: number): Coordinate {
  return {
    x: 0.18 + (index % 8) * 0.055,
    y: 0.82 - Math.floor(index / 8) * 0.055,
  };
}

export function getRoleForRoute(player?: Player): Role {
  return player?.role ?? 'Attack';
}
