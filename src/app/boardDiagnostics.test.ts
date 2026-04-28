import { describe, expect, it } from 'vitest';
import type { TacticalPlan } from '../types/domain';
import { getBoardDiagnostics } from './boardDiagnostics';

describe('board diagnostics', () => {
  it('counts active phase board objects and export pixels', () => {
    const diagnostics = getBoardDiagnostics(planFixture(), 'phase-1');

    expect(diagnostics).toMatchObject({
      rosterCount: 2,
      markerCount: 1,
      routeCount: 1,
      routePointCount: 2,
      objectiveCount: 1,
      zoneCount: 1,
      noteCount: 1,
      estimatedDrawableCount: 7,
      exportPixelCount: 5792 * 4344 * 4,
    });
  });
});

function planFixture(): TacticalPlan {
  return {
    version: 1,
    id: 'plan-1',
    title: 'Plan',
    roster: [{ id: 'player-1' } as never, { id: 'player-2' } as never],
    teams: [],
    phases: [
      {
        id: 'phase-1',
        name: 'Opening',
        playerMarkers: [{ id: 'marker-1' } as never],
        routes: [{ id: 'route-1', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } as never],
        objectives: [{ id: 'objective-1' } as never],
        zones: [{ id: 'zone-1' } as never],
        notes: [{ id: 'note-1' } as never],
      },
    ],
    updatedAt: '2026-04-28T00:00:00.000Z',
  };
}
