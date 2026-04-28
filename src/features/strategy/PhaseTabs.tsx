import { CopyPlus, Trash2 } from 'lucide-react';
import { usePlanStore } from '../../app/store';

export function PhaseTabs() {
  const { plan, activePhaseId, setActivePhase, addPhaseFromActive, removePhase, updatePhaseBriefing } = usePlanStore();
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
            <button className="phase-tab" onClick={() => setActivePhase(phase.id)}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {phase.name}
            </button>
            <button
              className="phase-delete"
              disabled={!canDeletePhase}
              onClick={() => removePhase(phase.id)}
              title={`Delete ${phase.name}`}
              aria-label={`Delete ${phase.name}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button className="phase-clone" onClick={addPhaseFromActive} title="Clone active phase">
          <CopyPlus size={16} />
        </button>
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
