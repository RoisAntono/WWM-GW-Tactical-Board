import { ArrowLeft, ArrowRight, CopyPlus, Trash2 } from 'lucide-react';
import { usePlanStore } from '../../app/store';
import type { PhaseDuplicateMode } from './phaseUtils';

const duplicateOptions: Array<{ value: PhaseDuplicateMode; label: string }> = [
  { value: 'all', label: 'Duplicate All' },
  { value: 'players', label: 'Players Only' },
  { value: 'objectives', label: 'Objectives Only' },
  { value: 'briefing', label: 'Empty + Briefing' },
];

export function PhaseTabs() {
  const {
    plan,
    activePhaseId,
    setActivePhase,
    addPhaseFromActive,
    renamePhase,
    movePhase,
    removePhase,
    updatePhaseBriefing,
  } = usePlanStore();
  const activePhase = plan.phases.find((phase) => phase.id === activePhaseId);
  const canDeletePhase = plan.phases.length > 1;

  return (
    <section className="phase-strip">
      <div className="phase-tabs" role="tablist" aria-label="Strategy phases">
        {plan.phases.map((phase, index) => (
          <div
            key={phase.id}
            className={`phase-tab-item ${phase.id === activePhaseId ? 'is-active' : ''}`}
          >
            <div
              className="phase-tab"
              role="tab"
              aria-selected={phase.id === activePhaseId}
              tabIndex={0}
              onClick={() => setActivePhase(phase.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActivePhase(phase.id);
                }
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <input
                className="phase-name-input"
                value={phase.name}
                aria-label={`Rename ${phase.name}`}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => renamePhase(phase.id, event.target.value)}
                onBlur={(event) => {
                  if (!event.target.value.trim()) {
                    renamePhase(phase.id, `Phase ${index + 1}`);
                  }
                }}
              />
            </div>
            <button
              className="phase-move"
              disabled={index === 0}
              onClick={() => movePhase(phase.id, -1)}
              title={`Move ${phase.name} left`}
              aria-label={`Move ${phase.name} left`}
            >
              <ArrowLeft size={13} />
            </button>
            <button
              className="phase-move"
              disabled={index === plan.phases.length - 1}
              onClick={() => movePhase(phase.id, 1)}
              title={`Move ${phase.name} right`}
              aria-label={`Move ${phase.name} right`}
            >
              <ArrowRight size={13} />
            </button>
            <button
              className="phase-delete"
              disabled={!canDeletePhase}
              onClick={() => {
                if (window.confirm(`Delete phase "${phase.name}"? This removes markers, routes, objectives, zones, notes, and briefing in this phase.`)) {
                  removePhase(phase.id);
                }
              }}
              title={`Delete ${phase.name}`}
              aria-label={`Delete ${phase.name}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <div className="phase-duplicate-control">
          <CopyPlus size={15} />
          <select
            className="phase-duplicate-select"
            value=""
            title="Duplicate active phase"
            aria-label="Duplicate active phase"
            onChange={(event) => {
              const value = event.target.value as PhaseDuplicateMode | '';
              if (value) {
                addPhaseFromActive(value);
                event.currentTarget.value = '';
              }
            }}
          >
            <option value="">Duplicate</option>
            {duplicateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activePhase ? (
        <input
          className="phase-briefing"
          value={activePhase.briefing ?? ''}
          onChange={(event) => updatePhaseBriefing(activePhase.id, event.target.value)}
          placeholder="Phase briefing note"
        />
      ) : null}
    </section>
  );
}
