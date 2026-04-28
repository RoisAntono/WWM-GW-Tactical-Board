import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Download, Edit3, Save, Trash2, X } from 'lucide-react';
import {
  cloudSlotIndexes,
  deleteCloudSlot,
  getCloudDeviceId,
  listCloudSlots,
  loadCloudSlot,
  renameCloudSlot,
  saveCloudSlot,
  type CloudSlotIndex,
  type CloudSlotMetadata,
} from '../../app/cloudSaveSlots';
import type { WorkspaceSharePayload } from '../../app/workspaceShareLink';

type CloudSavesDialogProps = {
  open: boolean;
  payload: WorkspaceSharePayload;
  onLoad: (payload: WorkspaceSharePayload) => void;
  onClose: () => void;
};

export function CloudSavesDialog({ open, payload, onLoad, onClose }: CloudSavesDialogProps) {
  const titleId = useId();
  const [slots, setSlots] = useState<CloudSlotMetadata[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busySlot, setBusySlot] = useState<CloudSlotIndex>();
  const deviceId = useMemo(() => (open ? getCloudDeviceId() : ''), [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshSlots();
  }, [open]);

  if (!open) {
    return null;
  }

  async function refreshSlots() {
    setError('');
    setStatus('Loading cloud saves...');
    try {
      setSlots(await listCloudSlots(deviceId));
      setStatus('');
    } catch (nextError) {
      setStatus('');
      setError(nextError instanceof Error ? nextError.message : 'Unable to load cloud saves.');
    }
  }

  async function saveSlot(slotIndex: CloudSlotIndex) {
    const existing = findSlot(slotIndex);
    if (existing && !window.confirm(`Overwrite ${existing.slotName}?`)) {
      return;
    }

    setBusySlot(slotIndex);
    setError('');
    try {
      const saved = await saveCloudSlot(slotIndex, payload, {
        deviceId,
        slotName: existing?.slotName ?? `Slot ${slotIndex}`,
      });
      setSlots((current) => upsertSlotMetadata(current, saved));
      setStatus(`${saved.slotName} saved.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save cloud slot.');
    } finally {
      setBusySlot(undefined);
    }
  }

  async function loadSlot(slotIndex: CloudSlotIndex) {
    const existing = findSlot(slotIndex);
    if (!existing) {
      return;
    }
    if (!window.confirm(`Load ${existing.slotName}? This replaces the current local workspace.`)) {
      return;
    }

    setBusySlot(slotIndex);
    setError('');
    try {
      const loaded = await loadCloudSlot(slotIndex, deviceId);
      onLoad(loaded.payload);
      setStatus(`${loaded.metadata.slotName} loaded.`);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load cloud slot.');
    } finally {
      setBusySlot(undefined);
    }
  }

  async function renameSlot(slotIndex: CloudSlotIndex) {
    const existing = findSlot(slotIndex);
    if (!existing) {
      return;
    }
    const nextName = window.prompt('Slot name', existing.slotName)?.trim();
    if (!nextName || nextName === existing.slotName) {
      return;
    }

    setBusySlot(slotIndex);
    setError('');
    try {
      const renamed = await renameCloudSlot(slotIndex, nextName, deviceId);
      setSlots((current) => upsertSlotMetadata(current, renamed));
      setStatus(`${renamed.slotName} renamed.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to rename cloud slot.');
    } finally {
      setBusySlot(undefined);
    }
  }

  async function clearSlot(slotIndex: CloudSlotIndex) {
    const existing = findSlot(slotIndex);
    if (!existing || !window.confirm(`Clear ${existing.slotName}?`)) {
      return;
    }

    setBusySlot(slotIndex);
    setError('');
    try {
      await deleteCloudSlot(slotIndex, deviceId);
      setSlots((current) => current.filter((slot) => slot.slotIndex !== slotIndex));
      setStatus(`${existing.slotName} cleared.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to clear cloud slot.');
    } finally {
      setBusySlot(undefined);
    }
  }

  function findSlot(slotIndex: CloudSlotIndex) {
    return slots.find((slot) => slot.slotIndex === slotIndex);
  }

  return createPortal(
    <div className="modal-backdrop cloud-saves-backdrop" role="presentation">
      <section className="cloud-saves-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Cloud Saves</p>
            <h2 id={titleId}>Save Slots</h2>
          </div>
          <button className="icon-button" title="Close" aria-label="Close cloud saves" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="cloud-saves-device">
          <Cloud size={16} />
          <span>Device {deviceId.slice(0, 8)}</span>
          <button className="secondary-button" onClick={refreshSlots}>
            Refresh
          </button>
        </div>

        {status ? <p className="share-status">{status}</p> : null}
        {error ? <p className="share-error">{error}</p> : null}

        <div className="cloud-slot-grid">
          {cloudSlotIndexes.map((slotIndex) => {
            const slot = findSlot(slotIndex);
            const busy = busySlot === slotIndex;
            return (
              <article key={slotIndex} className="cloud-slot-card">
                <div>
                  <p className="eyebrow">Slot {slotIndex}</p>
                  <h3>{slot?.slotName ?? `Slot ${slotIndex}`}</h3>
                  <p>{slot ? slot.snapshotTitle || 'Untitled workspace' : 'Empty cloud save'}</p>
                  <small>{slot ? `Updated ${formatDate(slot.updatedAt)}` : 'Save current workspace to start.'}</small>
                </div>
                <div className="cloud-slot-actions">
                  <button className="primary-button" disabled={busy} onClick={() => saveSlot(slotIndex)}>
                    <Save size={14} />
                    Save Current
                  </button>
                  <button className="secondary-button" disabled={busy || !slot} onClick={() => loadSlot(slotIndex)}>
                    <Download size={14} />
                    Load
                  </button>
                  <button className="icon-button" disabled={busy || !slot} title="Rename slot" aria-label={`Rename Slot ${slotIndex}`} onClick={() => renameSlot(slotIndex)}>
                    <Edit3 size={14} />
                  </button>
                  <button className="icon-button danger" disabled={busy || !slot} title="Clear slot" aria-label={`Clear Slot ${slotIndex}`} onClick={() => clearSlot(slotIndex)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function upsertSlotMetadata(slots: CloudSlotMetadata[], next: CloudSlotMetadata): CloudSlotMetadata[] {
  const rest = slots.filter((slot) => slot.slotIndex !== next.slotIndex);
  return [...rest, next].sort((left, right) => left.slotIndex - right.slotIndex);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
