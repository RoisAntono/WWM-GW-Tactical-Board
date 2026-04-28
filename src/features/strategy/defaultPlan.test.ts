import { describe, expect, it } from 'vitest';
import { createDefaultPlan } from './defaultPlan';

describe('default tactical plan', () => {
  it('starts clean while keeping the objective preset on the opening phase', () => {
    const plan = createDefaultPlan();
    const openingPhase = plan.phases[0];

    expect(plan.roster).toEqual([]);
    expect(openingPhase.playerMarkers).toEqual([]);
    expect(openingPhase.routes).toEqual([]);
    expect(openingPhase.zones).toEqual([]);
    expect(openingPhase.notes).toEqual([]);
    expect(openingPhase.briefing).toBe('');
    expect(openingPhase.objectives.length).toBeGreaterThan(0);
  });
});
