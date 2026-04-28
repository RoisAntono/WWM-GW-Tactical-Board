import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Save, X } from 'lucide-react';
import { cloudSlotIndexes, listCloudSlots, saveCloudSlot, type CloudSlotIndex, type CloudSlotMetadata } from '../../app/cloudSaveSlots';
import type { WorkspaceSharePayload } from '../../app/workspaceShareLink';
import { BoardSnapshotPreview } from '../board/BoardSnapshotPreview';

export type WorkspaceSharePreviewState =
  | { status: 'loading' }
  | { status: 'ready'; payload: WorkspaceSharePayload }
  | { status: 'error'; message: string };

type WorkspaceSharePreviewDialogProps = {
  state: WorkspaceSharePreviewState;
  onSave: (payload: WorkspaceSharePayload) => void | Promise<void>;
  onClose: () => void;
};

export function WorkspaceSharePreviewDialog({ state, onSave, onClose }: WorkspaceSharePreviewDialogProps) {
  const titleId = useId();
  const [selectedSlot, setSelectedSlot] = useState<CloudSlotIndex>(1);
  const [slots, setSlots] = useState<CloudSlotMetadata[]>([]);
  const [slotError, setSlotError] = useState('');
  const [saving, setSaving] = useState(false);
  const payload = state.status === 'ready' ? state.payload : undefined;
  const activePhase = payload?.plan.phases.find((phase) => phase.id === payload.activePhaseId) ?? payload?.plan.phases[0];

  useEffect(() => {
    if (state.status !== 'ready') {
      return;
    }

    let cancelled = false;
    setSlotError('');
    void listCloudSlots()
      .then((nextSlots) => {
        if (!cancelled) {
          setSlots(nextSlots);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSlotError(error instanceof Error ? error.message : 'Unable to load cloud slots.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [state.status]);

  const saveToSelectedSlot = async () => {
    if (!payload) {
      return;
    }

    const existing = slots.find((slot) => slot.slotIndex === selectedSlot);
    if (existing && !window.confirm(`Overwrite ${existing.slotName}?`)) {
      return;
    }

    setSaving(true);
    setSlotError('');
    try {
      await saveCloudSlot(selectedSlot, payload, { slotName: existing?.slotName ?? `Slot ${selectedSlot}` });
      await onSave(payload);
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : 'Unable to save shared workspace to cloud slot.');
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop share-preview-backdrop" role="presentation">
      <section className="share-preview-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Shared Workspace</p>
            <h2 id={titleId}>{state.status === 'error' ? 'Unable To Open Share Link' : 'Open Shared Workspace'}</h2>
          </div>
          <button className="icon-button" title="Close" aria-label="Close shared workspace preview" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {state.status === 'loading' ? (
          <div className="share-preview-loading">Opening encrypted workspace snapshot...</div>
        ) : state.status === 'error' ? (
          <div className="share-preview-error">
            <AlertTriangle size={18} />
            <span>{state.message}</span>
          </div>
        ) : payload ? (
          <>
            <div className="share-preview-summary" aria-label="Shared workspace summary">
              <PreviewStat label="Plan" value={payload.plan.title} />
              <PreviewStat label="Opponent" value={payload.plan.opponent?.trim() || '-'} />
              <PreviewStat label="Active Phase" value={activePhase?.name ?? '-'} />
              <PreviewStat label="Members" value={String(payload.guild.members.length)} />
              <PreviewStat label="Matches" value={String(payload.guild.matches.length)} />
              <PreviewStat label="Performances" value={String(payload.guild.performances.length)} />
              <PreviewStat label="Import Batches" value={String(payload.guild.importBatches.length)} />
            </div>

            <BoardSnapshotPreview plan={payload.plan} activePhaseId={payload.activePhaseId} />

            <div className="share-warning">
              <AlertTriangle size={16} />
              <span>Preview is read-only. Save Copy will replace your current local workspace with this snapshot.</span>
            </div>

            <div className="share-slot-picker" aria-label="Choose cloud save slot">
              <div>
                <p className="eyebrow">Save Destination</p>
                <strong>Choose a cloud slot before saving</strong>
              </div>
              <div className="share-slot-options">
                {cloudSlotIndexes.map((slotIndex) => {
                  const slot = slots.find((item) => item.slotIndex === slotIndex);
                  return (
                    <label key={slotIndex} className={`share-slot-option ${selectedSlot === slotIndex ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="share-slot"
                        checked={selectedSlot === slotIndex}
                        onChange={() => setSelectedSlot(slotIndex)}
                      />
                      <span>Slot {slotIndex}</span>
                      <small>{slot?.snapshotTitle || slot?.slotName || 'Empty'}</small>
                    </label>
                  );
                })}
              </div>
              {slotError ? <p className="share-error">{slotError}</p> : null}
            </div>
          </>
        ) : null}

        <div className="modal-actions">
          {payload ? (
            <button className="primary-button" disabled={saving} onClick={saveToSelectedSlot}>
              <Save size={15} />
              {saving ? 'Saving...' : 'Save Copy'}
            </button>
          ) : null}
          <button className="secondary-button" onClick={onClose}>
            {payload ? 'Cancel' : 'Close'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="share-preview-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
