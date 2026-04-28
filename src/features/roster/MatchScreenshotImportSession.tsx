import { createPortal } from 'react-dom';
import { FileImage, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ImportRow, ImportSource } from '../../types/domain';
import type { OcrProgress } from './ocrImport';

export type MatchScreenshotSessionFileStatus = 'queued' | 'processing' | 'done' | 'error';

export type MatchScreenshotSessionFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  status: MatchScreenshotSessionFileStatus;
  rowCount?: number;
  acceptedCount?: number;
  warningCount?: number;
  rows?: ImportRow[];
  matchTime?: string;
  timestampOnly?: boolean;
  confidenceAvg?: number;
  error?: string;
};

type MatchScreenshotImportSessionProps = {
  open: boolean;
  source: Extract<ImportSource, 'ocr' | 'gemini'>;
  files: MatchScreenshotSessionFile[];
  processing: boolean;
  progress?: OcrProgress;
  combinedRows: ImportRow[];
  duplicateCount: number;
  onAddFiles: () => void;
  onRemoveFile: (id: string) => void;
  onClear: () => void;
  onProcess: () => void;
  onReview: () => void;
  onCancel: () => void;
};

export function MatchScreenshotImportSession({
  open,
  source,
  files,
  processing,
  progress,
  combinedRows,
  duplicateCount,
  onAddFiles,
  onRemoveFile,
  onClear,
  onProcess,
  onReview,
  onCancel,
}: MatchScreenshotImportSessionProps) {
  if (!open) {
    return null;
  }

  const title = source === 'gemini' ? 'Match Gemini Session' : 'Match OCR Session';
  const doneCount = files.filter((file) => file.status === 'done').length;
  const errorCount = files.filter((file) => file.status === 'error').length;
  const extractedRowCount = files.reduce((total, file) => total + (file.rowCount ?? 0), 0);
  const acceptedRowCount = files.reduce((total, file) => total + (file.acceptedCount ?? 0), 0);
  const warningCount = files.reduce((total, file) => total + (file.warningCount ?? 0), 0);
  const timestampOnlyCount = files.filter((file) => file.timestampOnly).length;
  const canProcess = files.length > 0 && !processing;
  const canReview =
    combinedRows.length > 0 &&
    !processing &&
    files.every((file) => file.status === 'done' || file.status === 'error');

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <section className="screenshot-session-modal" role="dialog" aria-modal="true" aria-labelledby="screenshot-session-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Screenshot Batch</p>
            <h2 id="screenshot-session-title">{title}</h2>
          </div>
          <button className="ghost-button" onClick={onCancel} disabled={processing}>
            Close
          </button>
        </div>

        <div className="screenshot-session-summary" aria-label="Batch summary">
          <SummaryItem label="Files" value={String(files.length)} />
          <SummaryItem label="Processed" value={`${doneCount}/${files.length}`} />
          <SummaryItem label="Detected" value={String(extractedRowCount)} />
          <SummaryItem label="Accepted" value={String(acceptedRowCount)} />
          <SummaryItem label="Merged" value={String(duplicateCount)} />
          <SummaryItem label="Warnings" value={String(warningCount)} />
          <SummaryItem label="Time Only" value={String(timestampOnlyCount)} />
          <SummaryItem label="Errors" value={String(errorCount)} />
        </div>

        {progress ? (
          <div className="screenshot-progress">
            <span>{progress.status}</span>
            <strong>{Math.round(progress.progress * 100)}%</strong>
          </div>
        ) : null}

        <div className="screenshot-file-list" role="list">
          {files.length ? (
            files.map((item) => (
              <div className="screenshot-file-row" role="listitem" key={item.id}>
                <FileImage size={16} />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {formatFileSize(item.size)}
                    {item.rowCount !== undefined ? ` - ${item.rowCount} detected` : ''}
                    {item.acceptedCount !== undefined ? ` - ${item.acceptedCount} accepted` : ''}
                    {item.warningCount ? ` - ${item.warningCount} warnings` : ''}
                    {item.confidenceAvg !== undefined ? ` - ${item.confidenceAvg}% confidence` : ''}
                    {item.matchTime ? ` - ${item.matchTime}` : ''}
                    {item.timestampOnly ? ' - timestamp only' : ''}
                    {item.error ? ` - ${item.error}` : ''}
                  </small>
                </div>
                <span className={`screenshot-file-status is-${item.status}`}>{statusLabel(item.status)}</span>
                <button
                  className="icon-button"
                  onClick={() => onRemoveFile(item.id)}
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name}`}
                  disabled={processing}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          ) : (
            <div className="screenshot-empty-state">
              <FileImage size={24} />
              <span>No screenshots selected.</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onAddFiles} disabled={processing}>
            <Plus size={15} />
            Add Screenshots
          </button>
          <button className="secondary-button" onClick={onClear} disabled={processing || files.length === 0}>
            <RotateCcw size={15} />
            Clear
          </button>
          <button className="primary-button" onClick={onProcess} disabled={!canProcess}>
            <FileImage size={15} />
            Process
          </button>
          <button className="primary-button" onClick={onReview} disabled={!canReview}>
            <ListChecks size={15} />
            Review Rows
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(status: MatchScreenshotSessionFileStatus): string {
  if (status === 'processing') {
    return 'Processing';
  }
  if (status === 'done') {
    return 'Done';
  }
  if (status === 'error') {
    return 'Error';
  }
  return 'Queued';
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 KB';
  }

  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}
