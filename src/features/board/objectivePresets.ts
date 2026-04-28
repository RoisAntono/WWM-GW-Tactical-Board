import type { ObjectiveMarker } from '../../types/domain';

// Normalized coordinates are calibrated from the user's Guild Wars objective screenshot.
// Keep this file as the single source of truth for default objective locations.
export function createGuildWarsObjectivePreset(): ObjectiveMarker[] {
  return [
    tower('objective-blue-tower-north', 'Blue Tower North', 'blue-tower', 0.5973650685754409, 0.27109899327815257, 'ally'),
    tower('objective-blue-tower-mid', 'Blue Tower Mid', 'blue-tower', 0.5991620977895045, 0.46896700224061594, 'ally'),
    tower('objective-blue-tower-south', 'Blue Tower South', 'blue-tower', 0.5973650685754411, 0.66167989210621, 'ally'),
    tower('objective-red-tower-north', 'Red Tower North', 'red-tower', 0.39448270333510643, 0.27430196406408924, 'enemy'),
    tower('objective-red-tower-mid', 'Red Tower Mid', 'red-tower', 0.39733047524565396, 0.4669042966218647, 'enemy'),
    tower('objective-red-tower-south', 'Red Tower South', 'red-tower', 0.39548270333510643, 0.6666798921062098, 'enemy'),
    tower('objective-blue-tree-east', 'Blue Tree East', 'blue-tree', 0.8422597956306437, 0.46310726740780134, 'ally'),
    tower('objective-blue-goose-east', 'Blue Goose East', 'blue-goose', 0.8068773810107033, 0.43526238650467053, 'ally'),
    tower('objective-red-goose-west', 'Red Goose West', 'red-goose', 0.18132558977523341, 0.4403250921234216, 'enemy'),
    tower('objective-red-tree-west', 'Red Tree West', 'red-tree', 0.1459939178517773, 0.4694356494312402, 'enemy'),
    tower('objective-boss-center', 'Boss Summon', 'boss-summon', 0.4981522280894524, 0.575196390985902, 'neutral'),
    farm('objective-farm-nw-1', 'Farm NW 1', 0.35920915169337053, 0.39120297078593674),
    farm('objective-farm-nw-2', 'Farm NW 2', 0.43603588876680077, 0.38514026516718575),
    farm('objective-farm-ne-1', 'Farm NE 1', 0.56121782471562, 0.3412211146156374),
    farm('objective-farm-ne-2', 'Farm NE 2', 0.6400953044855343, 0.38514026516718564),
    farm('objective-farm-sw-1', 'Farm SW 1', 0.35210766630040213, 0.5522772404343539),
    farm('objective-farm-sw-2', 'Farm SW 2', 0.4290358887668007, 0.5953218022234043),
    farm('objective-farm-se-1', 'Farm SE 1', 0.5574207955015568, 0.5528085932437293),
    farm('objective-farm-se-2', 'Farm SE 2', 0.6344505033609237, 0.546277240434354),
  ];
}

function tower(
  id: string,
  label: string,
  type: ObjectiveMarker['type'],
  x: number,
  y: number,
  owner: ObjectiveMarker['owner'],
): ObjectiveMarker {
  return {
    id,
    type,
    label,
    owner,
    position: { x, y },
  };
}

function farm(id: string, label: string, x: number, y: number): ObjectiveMarker {
  return tower(id, label, 'red-farm', x, y, 'neutral');
}
