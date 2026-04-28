import type { Phase, TacticalPlan } from '../types/domain';

export type BoardDiagnostics = {
  rosterCount: number;
  markerCount: number;
  routeCount: number;
  routePointCount: number;
  objectiveCount: number;
  zoneCount: number;
  noteCount: number;
  estimatedDrawableCount: number;
  exportPixelCount: number;
};

export function getBoardDiagnostics(plan: TacticalPlan, activePhaseId: string): BoardDiagnostics {
  const phase = getActivePhase(plan, activePhaseId);
  const markerCount = phase?.playerMarkers.length ?? 0;
  const routeCount = phase?.routes.length ?? 0;
  const routePointCount = phase?.routes.reduce((total, route) => total + route.points.length, 0) ?? 0;
  const objectiveCount = phase?.objectives.length ?? 0;
  const zoneCount = phase?.zones.length ?? 0;
  const noteCount = phase?.notes.length ?? 0;

  return {
    rosterCount: plan.roster.length,
    markerCount,
    routeCount,
    routePointCount,
    objectiveCount,
    zoneCount,
    noteCount,
    estimatedDrawableCount: markerCount + routeCount + routePointCount + objectiveCount + zoneCount + noteCount,
    exportPixelCount: 5792 * 4344 * 4,
  };
}

function getActivePhase(plan: TacticalPlan, activePhaseId: string): Phase | undefined {
  return plan.phases.find((phase) => phase.id === activePhaseId) ?? plan.phases[0];
}
