import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  boardVisibilityPresets,
  defaultLayerVisibility,
  defaultObjectiveCategoryVisibility,
  objectiveLabels,
  type BoardVisibilityPresetKey,
} from '../shared/constants';
import { createId } from '../shared/id';
import { createDefaultPlan } from '../features/strategy/defaultPlan';
import { clonePhase, type PhaseDuplicateMode } from '../features/strategy/phaseUtils';
import { createGuildWarsObjectivePreset } from '../features/board/objectivePresets';
import {
  addGuildMember as addGuildMemberToDatabase,
  applyMatchImportRows as applyMatchImportRowsToDatabase,
  applyMemberImportRows as applyMemberImportRowsToDatabase,
  normalizeGuildDatabase,
  removeGuildMember as removeGuildMemberFromDatabase,
  updateGuildMember as updateGuildMemberInDatabase,
  updateGuildMemberFromPlayerPatch,
  upsertMembersFromRows,
  type ImportMode,
  type MatchImportMeta,
  type MemberImportMeta,
} from './data/guildRepository';
import { findMemberByIgn, normalizeDisplayIgn, normalizeIgn, uniqueImportRowsByIgn } from './data/domainUtils';
import {
  createPlayerFromGuildMember,
  createPlayerFromImportRow,
  ensureMarkersForRoster,
  getSafeActivePhaseId,
  mergePlayers,
  removeMemberFromPlan,
  removePlayerFromPlan,
  uniquePlayersByIgn,
} from './data/planRepository';
import { ensureGuildForPlan, syncPlanWithGuild } from './data/syncEngine';
import {
  appendWorkspaceHistory,
  prependWorkspaceFuture,
} from './storeHistory';
import { persistStorageName, persistVersion } from './persistenceConfig';
import { normalizePersistedState, type PersistedPlanState } from './storePersistence';
import { defaultSettings, type AppSettings } from './settings';
import type {
  BoardNote,
  Coordinate,
  GuildDatabase,
  GuildMember,
  ImportRow,
  LayerKey,
  LayerVisibility,
  ObjectiveMarker,
  ObjectiveCategory,
  ObjectiveCategoryVisibility,
  ObjectiveType,
  Phase,
  Player,
  Role,
  Route,
  TacticalPlan,
  ToolMode,
  WorkspaceBackup,
  WorkspaceSnapshot,
  Zone,
} from '../types/domain';

export { normalizePersistedState } from './storePersistence';

type PlanStore = {
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
  historyPast: WorkspaceSnapshot[];
  historyFuture: WorkspaceSnapshot[];
  selectedPlayerId?: string;
  selectedRouteId?: string;
  selectedObjectiveId?: string;
  selectedNoteId?: string;
  tool: ToolMode;
  layerVisibility: LayerVisibility;
  objectiveCategoryVisibility: ObjectiveCategoryVisibility;
  settings: AppSettings;
  undo: () => void;
  redo: () => void;
  clearSelection: () => void;
  setPlan: (plan: TacticalPlan) => void;
  resetPlan: () => void;
  setPlanMeta: (meta: Pick<TacticalPlan, 'title' | 'opponent'>) => void;
  setActivePhase: (phaseId: string) => void;
  addPhaseFromActive: (mode?: PhaseDuplicateMode) => void;
  renamePhase: (phaseId: string, name: string) => void;
  movePhase: (phaseId: string, direction: -1 | 1) => void;
  removePhase: (phaseId: string) => void;
  updatePhaseBriefing: (phaseId: string, briefing: string) => void;
  sanitizePlan: () => void;
  setTool: (tool: ToolMode) => void;
  toggleLayer: (layer: LayerKey) => void;
  toggleObjectiveCategory: (category: ObjectiveCategory) => void;
  setBoardVisibilityPreset: (preset: BoardVisibilityPresetKey) => void;
  setGeminiApiKey: (apiKey: string) => void;
  clearGeminiApiKey: () => void;
  setSuppressOcrWarning: (suppress: boolean) => void;
  selectPlayer: (playerId?: string) => void;
  selectRoute: (routeId?: string) => void;
  selectObjective: (objectiveId?: string) => void;
  selectNote: (noteId?: string) => void;
  addGuildMember: (ign: string) => void;
  updateGuildMember: (memberId: string, patch: Partial<GuildMember>) => void;
  removeGuildMember: (memberId: string) => void;
  addMemberToPlan: (memberId: string) => void;
  addManualPlayer: (ign: string) => void;
  updatePlayer: (playerId: string, patch: Partial<Player>) => void;
  removePlayer: (playerId: string) => void;
  applyImportRows: (rows: ImportRow[], mode: ImportMode) => void;
  applyMemberImportRows: (rows: ImportRow[], mode: ImportMode, meta?: MemberImportMeta) => void;
  applyMatchImportRows: (rows: ImportRow[], meta: MatchImportMeta) => void;
  setGuildDatabase: (guild: GuildDatabase) => void;
  setWorkspaceBackup: (backup: WorkspaceBackup) => void;
  setWorkspaceSnapshot: (snapshot: WorkspaceSnapshot) => void;
  addPlayerMarker: (playerId: string, position: Coordinate) => void;
  removePlayerMarker: (playerId: string) => void;
  movePlayerMarker: (markerId: string, position: Coordinate) => void;
  updateMarkerTask: (markerId: string, task: string) => void;
  addRoutePoint: (position: Coordinate) => void;
  completeRoute: () => void;
  removeRoute: (routeId: string) => void;
  addObjective: (type: ObjectiveType, position: Coordinate) => void;
  moveObjective: (objectiveId: string, position: Coordinate) => void;
  replaceActiveObjectivesWithPreset: () => void;
  removeObjective: (objectiveId: string) => void;
  addZone: (points: Coordinate[]) => void;
  addNote: (position: Coordinate) => void;
  updateNote: (noteId: string, text: string) => void;
  removeNote: (noteId: string) => void;
  removeSelected: () => void;
};

const bootstrappedState = ensureGuildForPlan(createDefaultPlan());
const initialPlan = bootstrappedState.plan;
const initialGuild = bootstrappedState.guild;

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      plan: initialPlan,
      guild: initialGuild,
      activePhaseId: initialPlan.phases[0]?.id ?? '',
      historyPast: [],
      historyFuture: [],
      tool: 'select',
      layerVisibility: defaultLayerVisibility,
      objectiveCategoryVisibility: defaultObjectiveCategoryVisibility,
      settings: defaultSettings,
      undo: () => {
        const { historyPast } = get();
        const previous = historyPast.at(-1);
        if (!previous) {
          return;
        }

        set((state) => ({
          plan: previous.plan,
          guild: previous.guild,
          activePhaseId: getSafeActivePhaseId(previous.plan, previous.activePhaseId),
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: prependWorkspaceFuture(state.historyFuture, state),
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
        }));
      },
      redo: () => {
        const { historyFuture } = get();
        const next = historyFuture[0];
        if (!next) {
          return;
        }

        set((state) => ({
          plan: next.plan,
          guild: next.guild,
          activePhaseId: getSafeActivePhaseId(next.plan, next.activePhaseId),
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: state.historyFuture.slice(1),
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
        }));
      },
      clearSelection: () =>
        set({
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        }),
      setPlan: (plan) => {
        const { plan: sanitizedPlan, guild } = ensureGuildForPlan(plan, get().guild);
        set((state) => ({
          plan: sanitizedPlan,
          guild,
          activePhaseId: sanitizedPlan.phases[0]?.id ?? '',
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: [],
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        }));
      },
      resetPlan: () => {
        const { plan, guild } = ensureGuildForPlan(createDefaultPlan());
        set((state) => ({
          plan,
          guild,
          activePhaseId: plan.phases[0]?.id ?? '',
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: [],
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
          layerVisibility: defaultLayerVisibility,
          objectiveCategoryVisibility: defaultObjectiveCategoryVisibility,
        }));
      },
      setPlanMeta: (meta) =>
        mutatePlan(set, (plan) => ({
          ...plan,
          title: meta.title,
          opponent: meta.opponent,
        })),
      setActivePhase: (phaseId) =>
        set({
          activePhaseId: phaseId,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        }),
      addPhaseFromActive: (mode = 'all') => {
        const { plan, activePhaseId } = get();
        const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
        if (!activePhase) {
          return;
        }

        const phase = clonePhase(activePhase, `${activePhase.name} Variant`, mode);
        mutatePlan(set, (currentPlan) => ({
          ...currentPlan,
          phases: [...currentPlan.phases, phase],
        }));
        set({ activePhaseId: phase.id });
      },
      renamePhase: (phaseId, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return;
        }

        updatePhase(set, phaseId, (phase) => ({
          ...phase,
          name: trimmedName,
        }));
      },
      movePhase: (phaseId, direction) => {
        const { plan } = get();
        const currentIndex = plan.phases.findIndex((phase) => phase.id === phaseId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= plan.phases.length) {
          return;
        }

        const phases = [...plan.phases];
        const [phase] = phases.splice(currentIndex, 1);
        phases.splice(nextIndex, 0, phase);

        mutatePlan(set, (currentPlan) => ({
          ...currentPlan,
          phases,
        }));
      },
      removePhase: (phaseId) => {
        const { plan, activePhaseId } = get();
        if (plan.phases.length <= 1) {
          return;
        }

        const phaseIndex = plan.phases.findIndex((phase) => phase.id === phaseId);
        const phases = plan.phases.filter((phase) => phase.id !== phaseId);
        const nextActivePhaseId =
          activePhaseId === phaseId ? phases[Math.max(0, phaseIndex - 1)]?.id ?? phases[0]?.id ?? '' : activePhaseId;

        mutatePlan(set, (currentPlan) => ({
          ...currentPlan,
          phases,
        }));
        set({
          activePhaseId: nextActivePhaseId,
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        });
      },
      updatePhaseBriefing: (phaseId, briefing) =>
        updatePhase(set, phaseId, (phase) => ({
          ...phase,
          briefing,
        })),
      sanitizePlan: () => {
        const { plan, activePhaseId, guild } = get();
        const { plan: sanitizedPlan, guild: sanitizedGuild } = ensureGuildForPlan(plan, guild);
        const phaseExists = sanitizedPlan.phases.some((phase) => phase.id === activePhaseId);

        set({
          plan: sanitizedPlan,
          guild: sanitizedGuild,
          activePhaseId: phaseExists ? activePhaseId : sanitizedPlan.phases[0]?.id ?? '',
        });
      },
      setTool: (tool) => set({ tool }),
      toggleLayer: (layer) =>
        set((state) => ({
          layerVisibility: {
            ...state.layerVisibility,
            [layer]: !state.layerVisibility[layer],
          },
        })),
      toggleObjectiveCategory: (category) =>
        set((state) => {
          const currentVisibility = state.objectiveCategoryVisibility ?? defaultObjectiveCategoryVisibility;
          return {
            objectiveCategoryVisibility: {
              ...defaultObjectiveCategoryVisibility,
              ...currentVisibility,
              [category]: !currentVisibility[category],
            },
          };
        }),
      setBoardVisibilityPreset: (presetKey) => {
        const preset = boardVisibilityPresets[presetKey];
        set({
          layerVisibility: { ...preset.layers },
          objectiveCategoryVisibility: { ...preset.objectiveCategories },
        });
      },
      setGeminiApiKey: (apiKey) =>
        set((state) => ({
          settings: {
            ...state.settings,
            geminiApiKey: apiKey.trim(),
          },
        })),
      clearGeminiApiKey: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            geminiApiKey: '',
          },
        })),
      setSuppressOcrWarning: (suppressOcrWarning) =>
        set((state) => ({
          settings: {
            ...state.settings,
            suppressOcrWarning,
          },
        })),
      selectPlayer: (selectedPlayerId) =>
        set({
          selectedPlayerId,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        }),
      selectRoute: (selectedRouteId) =>
        set({
          selectedRouteId,
          selectedPlayerId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        }),
      selectObjective: (selectedObjectiveId) =>
        set({
          selectedObjectiveId,
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedNoteId: undefined,
        }),
      selectNote: (selectedNoteId) =>
        set({
          selectedNoteId,
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
        }),
      addGuildMember: (ign) => {
        set((state) => {
          const nextGuild = addGuildMemberToDatabase(state.guild, ign);
          if (nextGuild === state.guild) {
            return {};
          }

          return {
            guild: nextGuild,
            plan: syncPlanWithGuild(state.plan, nextGuild),
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          };
        });
      },
      updateGuildMember: (memberId, patch) => {
        set((state) => {
          const nextGuild = updateGuildMemberInDatabase(state.guild, memberId, patch);
          const plan = syncPlanWithGuild(state.plan, nextGuild);
          const planChanged = plan !== state.plan;

          return {
            plan,
            guild: nextGuild,
            historyPast: planChanged || nextGuild !== state.guild ? appendWorkspaceHistory(state.historyPast, state) : state.historyPast,
            historyFuture: planChanged || nextGuild !== state.guild ? [] : state.historyFuture,
          };
        });
      },
      removeGuildMember: (memberId) => {
        set((state) => {
          const { plan: planWithoutMember, removedPlayerIds } = removeMemberFromPlan(state.plan, memberId);
          const removedPlayerIdSet = new Set(removedPlayerIds);
          const nextGuild = removeGuildMemberFromDatabase(state.guild, memberId);
          const plan = syncPlanWithGuild(planWithoutMember, nextGuild);

          return {
            plan,
            guild: nextGuild,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
            selectedPlayerId: removedPlayerIdSet.has(state.selectedPlayerId ?? '') ? undefined : state.selectedPlayerId,
          };
        });
      },
      addMemberToPlan: (memberId) => {
        const member = get().guild.members.find((item) => item.id === memberId);
        if (!member) {
          return;
        }

        const existingPlayer = get().plan.roster.find(
          (player) => player.memberId === memberId || normalizeIgn(player.ign) === normalizeIgn(member.ign),
        );
        if (existingPlayer) {
          set({
            selectedPlayerId: existingPlayer.id,
            selectedRouteId: undefined,
            selectedObjectiveId: undefined,
            selectedNoteId: undefined,
          });
          return;
        }

        const player = createPlayerFromGuildMember(member);
        mutatePlan(set, (plan) => syncPlanWithGuild({ ...plan, roster: [...plan.roster, player] }, get().guild));
        set({ selectedPlayerId: player.id });
      },
      addManualPlayer: (ign) => {
        const trimmedIgn = normalizeDisplayIgn(ign);
        if (!trimmedIgn) {
          return;
        }

        const existingPlayer = get().plan.roster.find((player) => normalizeIgn(player.ign) === normalizeIgn(trimmedIgn));
        if (existingPlayer) {
          set({
            selectedPlayerId: existingPlayer.id,
            selectedRouteId: undefined,
            selectedObjectiveId: undefined,
            selectedNoteId: undefined,
          });
          return;
        }

        let member = findMemberByIgn(get().guild.members, trimmedIgn);
        if (!member) {
          const nextGuild = addGuildMemberToDatabase(get().guild, trimmedIgn);
          member = findMemberByIgn(nextGuild.members, trimmedIgn);
          if (!member) {
            return;
          }

          const player = createPlayerFromGuildMember(member);
          set((state) => ({
            guild: nextGuild,
            plan: syncPlanWithGuild({ ...state.plan, roster: [...state.plan.roster, player] }, nextGuild),
            selectedPlayerId: player.id,
            selectedRouteId: undefined,
            selectedObjectiveId: undefined,
            selectedNoteId: undefined,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          }));
          return;
        }

        get().addMemberToPlan(member.id);
      },
      updatePlayer: (playerId, patch) => {
        const nextIgn = patch.ign !== undefined ? normalizeDisplayIgn(patch.ign) : undefined;

        if (patch.ign !== undefined) {
          if (!nextIgn) {
            return;
          }

          const duplicate = get().plan.roster.some(
            (player) => player.id !== playerId && normalizeIgn(player.ign) === normalizeIgn(nextIgn),
          );
          if (duplicate) {
            return;
          }
        }

        const normalizedPatch = patch.ign !== undefined ? { ...patch, ign: nextIgn } : patch;
        set((state) => {
          const player = state.plan.roster.find((item) => item.id === playerId);
          const memberId = player?.memberId;
          const nextGuild = memberId ? updateGuildMemberFromPlayerPatch(state.guild, memberId, normalizedPatch) : state.guild;
          const plan = memberId
            ? syncPlanWithGuild(state.plan, nextGuild)
            : {
                ...state.plan,
                roster: state.plan.roster.map((item) => (item.id === playerId ? { ...item, ...normalizedPatch } : item)),
                updatedAt: new Date().toISOString(),
              };

          return {
            plan,
            guild: nextGuild,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          };
        });
      },
      removePlayer: (playerId) => {
        mutatePlan(set, (plan) => removePlayerFromPlan(plan, playerId));

        if (get().selectedPlayerId === playerId) {
          set({ selectedPlayerId: undefined });
        }
      },
      applyImportRows: (rows, mode) => {
        const validRows = uniqueImportRowsByIgn(rows.filter((row) => row.ign.trim()));
        const { plan, activePhaseId, guild } = get();
        const { guild: nextGuild, memberByIgn } = upsertMembersFromRows(guild, validRows, plan.teams, 'Member');
        const importedPlayers = validRows.map((row) => {
          const member = memberByIgn.get(normalizeIgn(row.ign));
          return createPlayerFromImportRow(row, plan.teams, member?.id);
        });
        const roster = mode === 'replace' ? uniquePlayersByIgn(importedPlayers) : mergePlayers(plan.roster, importedPlayers);
        const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
        const markerBaseIndex = activePhase?.playerMarkers.length ?? 0;

        set((state) => {
          const nextPlan = syncPlanWithGuild(
            {
            ...state.plan,
            roster,
            phases: state.plan.phases.map((phase) =>
              phase.id === activePhaseId
                ? {
                    ...phase,
                    playerMarkers: ensureMarkersForRoster(phase, roster, markerBaseIndex),
                  }
                : phase,
            ),
            updatedAt: new Date().toISOString(),
            },
            nextGuild,
          );

          return {
            guild: nextGuild,
            plan: nextPlan,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          };
        });
      },
      applyMemberImportRows: (rows, mode, meta) => {
        set((state) => {
          const nextGuild = applyMemberImportRowsToDatabase(state.guild, rows, mode, state.plan.teams, meta);
          const nextPlan = syncPlanWithGuild(state.plan, nextGuild);

          return {
            guild: nextGuild,
            plan: nextPlan,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          };
        });
      },
      applyMatchImportRows: (rows, meta) => {
        set((state) => {
          const nextGuild = applyMatchImportRowsToDatabase(state.guild, rows, state.plan.teams, meta);
          const plan = syncPlanWithGuild(state.plan, nextGuild);

          return {
            guild: nextGuild,
            plan,
            historyPast: appendWorkspaceHistory(state.historyPast, state),
            historyFuture: [],
          };
        });
      },
      setGuildDatabase: (guild) => {
        const normalizedGuild = normalizeGuildDatabase(guild);
        const { plan, guild: linkedGuild } = ensureGuildForPlan(get().plan, normalizedGuild);
        set((state) => ({
          plan,
          guild: linkedGuild,
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: [],
        }));
      },
      setWorkspaceBackup: (backup) => {
        const normalizedGuild = normalizeGuildDatabase(backup.guild);
        const { plan, guild } = ensureGuildForPlan(backup.plan, normalizedGuild);
        set((state) => ({
          plan,
          guild,
          activePhaseId: plan.phases[0]?.id ?? '',
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: [],
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
        }));
      },
      setWorkspaceSnapshot: (snapshot) => {
        const normalizedGuild = normalizeGuildDatabase(snapshot.guild);
        const { plan, guild } = ensureGuildForPlan(snapshot.plan, normalizedGuild);
        set((state) => ({
          plan,
          guild,
          activePhaseId: getSafeActivePhaseId(plan, snapshot.activePhaseId),
          historyPast: appendWorkspaceHistory(state.historyPast, state),
          historyFuture: [],
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
        }));
      },
      addPlayerMarker: (playerId, position) =>
        updateActivePhase(set, get, (phase) => {
          const existingMarker = phase.playerMarkers.find((marker) => marker.playerId === playerId);

          return {
            ...phase,
            playerMarkers: [
              ...phase.playerMarkers.filter((marker) => marker.playerId !== playerId),
              {
                id: existingMarker?.id ?? createId('marker'),
                playerId,
                position,
                priority: existingMarker?.priority ?? 'normal',
                task: existingMarker?.task ?? 'New assignment',
                routeId: existingMarker?.routeId,
              },
            ],
          };
        }),
      removePlayerMarker: (playerId) => {
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          playerMarkers: phase.playerMarkers.filter((marker) => marker.playerId !== playerId),
        }));

        if (get().selectedPlayerId === playerId) {
          set({ selectedPlayerId: undefined });
        }
      },
      movePlayerMarker: (markerId, position) =>
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          playerMarkers: phase.playerMarkers.map((marker) =>
            marker.id === markerId ? { ...marker, position } : marker,
          ),
        })),
      updateMarkerTask: (markerId, task) =>
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          playerMarkers: phase.playerMarkers.map((marker) => (marker.id === markerId ? { ...marker, task } : marker)),
        })),
      addRoutePoint: (position) => {
        const { selectedRouteId, plan } = get();
        const fallbackRole = plan.roster.find((player) => player.id === get().selectedPlayerId)?.role ?? 'Attack';

        if (selectedRouteId) {
          updateActivePhase(set, get, (phase) => ({
            ...phase,
            routes: phase.routes.map((route) =>
              route.id === selectedRouteId ? { ...route, points: [...route.points, position] } : route,
            ),
          }));
          return;
        }

        const route: Route = {
          id: createId('route'),
          name: 'New Route',
          role: fallbackRole,
          points: [position],
          style: 'solid',
          assignedPlayerIds: get().selectedPlayerId ? [get().selectedPlayerId!] : [],
        };
        updateActivePhase(set, get, (phase) => ({ ...phase, routes: [...phase.routes, route] }));
        set({ selectedRouteId: route.id });
      },
      completeRoute: () => {
        const { selectedRouteId, plan, activePhaseId } = get();
        const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
        const selectedRoute = activePhase?.routes.find((route) => route.id === selectedRouteId);

        if (selectedRoute && selectedRoute.points.length < 2) {
          get().removeRoute(selectedRoute.id);
        }

        set({ selectedRouteId: undefined, tool: 'select' });
      },
      removeRoute: (routeId) => {
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          routes: phase.routes.filter((route) => route.id !== routeId),
          playerMarkers: phase.playerMarkers.map((marker) =>
            marker.routeId === routeId ? { ...marker, routeId: undefined } : marker,
          ),
        }));

        if (get().selectedRouteId === routeId) {
          set({ selectedRouteId: undefined });
        }
      },
      addObjective: (type, position) => {
        const objective: ObjectiveMarker = {
          id: createId('objective'),
          type,
          label: objectiveLabels[type],
          owner: type.startsWith('blue') ? 'ally' : type.startsWith('red') ? 'enemy' : 'neutral',
          position,
        };
        updateActivePhase(set, get, (phase) => ({ ...phase, objectives: [...phase.objectives, objective] }));
        set({ selectedObjectiveId: objective.id, tool: 'select' });
      },
      moveObjective: (objectiveId, position) =>
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          objectives: phase.objectives.map((objective) =>
            objective.id === objectiveId ? { ...objective, position } : objective,
          ),
        })),
      replaceActiveObjectivesWithPreset: () =>
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          objectives: createGuildWarsObjectivePreset(),
        })),
      removeObjective: (objectiveId) => {
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          objectives: phase.objectives.filter((objective) => objective.id !== objectiveId),
        }));

        if (get().selectedObjectiveId === objectiveId) {
          set({ selectedObjectiveId: undefined });
        }
      },
      addZone: (points) => {
        const zone: Zone = {
          id: createId('zone'),
          name: 'Control Zone',
          role: 'Defense',
          points,
          opacity: 0.2,
        };
        updateActivePhase(set, get, (phase) => ({ ...phase, zones: [...phase.zones, zone] }));
      },
      addNote: (position) => {
        const note: BoardNote = {
          id: createId('note'),
          text: 'New note',
          position,
        };
        updateActivePhase(set, get, (phase) => ({ ...phase, notes: [...phase.notes, note] }));
        set({ selectedNoteId: note.id, tool: 'select' });
      },
      updateNote: (noteId, text) =>
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          notes: phase.notes.map((note) => (note.id === noteId ? { ...note, text } : note)),
        })),
      removeNote: (noteId) => {
        updateActivePhase(set, get, (phase) => ({
          ...phase,
          notes: phase.notes.filter((note) => note.id !== noteId),
        }));

        if (get().selectedNoteId === noteId) {
          set({ selectedNoteId: undefined });
        }
      },
      removeSelected: () => {
        const { selectedPlayerId, selectedRouteId, selectedObjectiveId, selectedNoteId, activePhaseId } = get();

        if (selectedRouteId) {
          get().removeRoute(selectedRouteId);
        }
        if (selectedObjectiveId) {
          get().removeObjective(selectedObjectiveId);
        }
        if (selectedPlayerId) {
          updatePhase(set, activePhaseId, (phase) => ({
            ...phase,
            playerMarkers: phase.playerMarkers.filter((marker) => marker.playerId !== selectedPlayerId),
          }));
        }
        if (selectedNoteId) {
          updatePhase(set, activePhaseId, (phase) => ({
            ...phase,
            notes: phase.notes.filter((note) => note.id !== selectedNoteId),
          }));
        }

        set({
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
          tool: 'select',
        });
      },
    }),
    {
      name: persistStorageName,
      version: persistVersion,
      partialize: (state) => ({
        plan: state.plan,
        guild: state.guild,
        activePhaseId: state.activePhaseId,
        layerVisibility: state.layerVisibility,
        objectiveCategoryVisibility: state.objectiveCategoryVisibility,
        settings: state.settings,
      }),
      migrate: (persistedState) => {
        return normalizePersistedState(persistedState as PersistedPlanState);
      },
      merge: (persistedState, currentState) => {
        const state = persistedState as PersistedPlanState;
        return {
          ...currentState,
          ...state,
          ...normalizePersistedState(state),
          historyPast: [],
          historyFuture: [],
          selectedPlayerId: undefined,
          selectedRouteId: undefined,
          selectedObjectiveId: undefined,
          selectedNoteId: undefined,
        };
      },
    },
  ),
);

function mutatePlan(
  set: (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void,
  updater: (plan: TacticalPlan) => TacticalPlan,
  options: { captureHistory?: boolean } = { captureHistory: true },
): void {
  set((state) => ({
    plan: {
      ...updater(state.plan),
      updatedAt: new Date().toISOString(),
    },
    historyPast:
      options.captureHistory === false
        ? state.historyPast
        : appendWorkspaceHistory(state.historyPast, state),
    historyFuture: options.captureHistory === false ? state.historyFuture : [],
  }));
}

function updateActivePhase(
  set: (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void,
  get: () => PlanStore,
  updater: (phase: Phase) => Phase,
): void {
  updatePhase(set, get().activePhaseId, updater);
}

function updatePhase(
  set: (partial: Partial<PlanStore> | ((state: PlanStore) => Partial<PlanStore>)) => void,
  phaseId: string,
  updater: (phase: Phase) => Phase,
): void {
  mutatePlan(set, (plan) => ({
    ...plan,
    phases: plan.phases.map((phase) => (phase.id === phaseId ? updater(phase) : phase)),
  }));
}
