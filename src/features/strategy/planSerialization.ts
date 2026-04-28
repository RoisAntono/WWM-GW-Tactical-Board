import type { TacticalPlan } from '../../types/domain';

export function serializePlan(plan: TacticalPlan): string {
  return JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }, null, 2);
}

export function parsePlanJson(content: string): TacticalPlan {
  const parsed = JSON.parse(content) as Partial<TacticalPlan>;

  if (parsed.version !== 1 || !Array.isArray(parsed.roster) || !Array.isArray(parsed.phases)) {
    throw new Error('Invalid WWM plan file.');
  }

  return {
    id: parsed.id ?? crypto.randomUUID(),
    version: 1,
    title: parsed.title ?? 'Imported Tactical Plan',
    opponent: parsed.opponent ?? '',
    roster: parsed.roster,
    teams: parsed.teams ?? [],
    phases: parsed.phases,
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}
