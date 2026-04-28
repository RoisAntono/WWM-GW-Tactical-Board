import { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Save, X } from 'lucide-react';
import type { WorkspaceSharePayload } from '../../app/workspaceShareLink';
import { BoardSnapshotPreview } from '../board/BoardSnapshotPreview';

export type WorkspaceSharePreviewState =
  | { status: 'loading' }
  | { status: 'ready'; payload: WorkspaceSharePayload }
  | { status: 'error'; message: string };

type WorkspaceSharePreviewDialogProps = {
  state: WorkspaceSharePreviewState;
  onSave: (payload: WorkspaceSharePayload) => void;
  onClose: () => void;
};

export function WorkspaceSharePreviewDialog({ state, onSave, onClose }: WorkspaceSharePreviewDialogProps) {
  const titleId = useId();
  const payload = state.status === 'ready' ? state.payload : undefined;
  const activePhase = payload?.plan.phases.find((phase) => phase.id === payload.activePhaseId) ?? payload?.plan.phases[0];

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
          </>
        ) : null}

        <div className="modal-actions">
          {payload ? (
            <button className="primary-button" onClick={() => onSave(payload)}>
              <Save size={15} />
              Save Copy
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
