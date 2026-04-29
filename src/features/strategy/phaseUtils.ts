import { createId } from '../../shared/id';
import type { Phase } from '../../types/domain';

export type PhaseDuplicateMode = 'all' | 'players' | 'objectives' | 'briefing';

export function clonePhase(source: Phase, name = `${source.name} Copy`, mode: PhaseDuplicateMode = 'all'): Phase {
  return {
    ...source,
    id: createId('phase'),
    name,
    playerMarkers: mode === 'all' || mode === 'players'
      ? source.playerMarkers.map((marker) => ({ ...marker, id: createId('marker') }))
      : [],
    routes: mode === 'all'
      ? source.routes.map((route) => ({ ...route, id: createId('route'), points: [...route.points] }))
      : [],
    objectives: mode === 'all' || mode === 'objectives'
      ? source.objectives.map((objective) => ({ ...objective, id: createId('objective') }))
      : [],
    zones: mode === 'all'
      ? source.zones.map((zone) => ({ ...zone, id: createId('zone'), points: [...zone.points] }))
      : [],
    notes: mode === 'all' ? source.notes.map((note) => ({ ...note, id: createId('note') })) : [],
    briefing: mode === 'all' || mode === 'briefing' ? source.briefing : '',
  };
}
