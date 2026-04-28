import { defaultPhaseNames, defaultPlanTeams } from '../../shared/constants';
import { createId } from '../../shared/id';
import type { Phase, TacticalPlan } from '../../types/domain';
import { createGuildWarsObjectivePreset } from '../board/objectivePresets';

export function createDefaultPhase(name: string, index = 0): Phase {
  return {
    id: createId('phase'),
    name,
    playerMarkers: [],
    routes: [],
    objectives: index === 0 ? createGuildWarsObjectivePreset() : [],
    zones: [],
    notes: [],
    briefing: '',
  };
}

export function createDefaultPlan(): TacticalPlan {
  return {
    version: 1,
    id: createId('plan'),
    title: 'Guild Wars Tactical Plan',
    opponent: '',
    roster: [],
    teams: defaultPlanTeams,
    phases: defaultPhaseNames.map(createDefaultPhase),
    updatedAt: new Date().toISOString(),
  };
}
