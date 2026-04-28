import { createId } from '../../shared/id';
import type { Phase } from '../../types/domain';

export function clonePhase(source: Phase, name = `${source.name} Copy`): Phase {
  return {
    ...source,
    id: createId('phase'),
    name,
    playerMarkers: source.playerMarkers.map((marker) => ({ ...marker, id: createId('marker') })),
    routes: source.routes.map((route) => ({ ...route, id: createId('route'), points: [...route.points] })),
    objectives: source.objectives.map((objective) => ({ ...objective, id: createId('objective') })),
    zones: source.zones.map((zone) => ({ ...zone, id: createId('zone'), points: [...zone.points] })),
    notes: source.notes.map((note) => ({ ...note, id: createId('note') })),
  };
}
