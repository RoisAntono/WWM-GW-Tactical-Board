import { createDefaultPlan } from '../features/strategy/defaultPlan';
import { defaultLayerVisibility, defaultObjectiveCategoryVisibility } from '../shared/constants';
import type {
  GuildDatabase,
  LayerVisibility,
  ObjectiveCategoryVisibility,
  TacticalPlan,
} from '../types/domain';
import { getSafeActivePhaseId, sanitizeTacticalPlan } from './data/planRepository';
import { ensureGuildForPlan } from './data/syncEngine';
import { normalizeSettings, type AppSettings } from './settings';

export type PersistedPlanState = Partial<{
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
  layerVisibility: LayerVisibility;
  objectiveCategoryVisibility: ObjectiveCategoryVisibility;
  settings: AppSettings;
}>;

export type HydratedPlanState = {
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
  layerVisibility: LayerVisibility;
  objectiveCategoryVisibility: ObjectiveCategoryVisibility;
  settings: AppSettings;
};

export function normalizePersistedState(state: PersistedPlanState): HydratedPlanState {
  const plan = sanitizeTacticalPlan(state.plan ?? createDefaultPlan());
  const { plan: linkedPlan, guild } = ensureGuildForPlan(plan, state.guild);

  return {
    plan: linkedPlan,
    guild,
    activePhaseId: getSafeActivePhaseId(linkedPlan, state.activePhaseId),
    layerVisibility: { ...defaultLayerVisibility, ...state.layerVisibility },
    objectiveCategoryVisibility: {
      ...defaultObjectiveCategoryVisibility,
      ...state.objectiveCategoryVisibility,
    },
    settings: normalizeSettings(state.settings),
  };
}
