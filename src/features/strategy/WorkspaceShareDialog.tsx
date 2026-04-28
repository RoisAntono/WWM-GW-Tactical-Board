import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Link2, X } from 'lucide-react';

type WorkspaceShareDialogProps = {
  open: boolean;
  shareUrl: string;
  loading: boolean;
  error: string;
  notice: string;
  onClose: () => void;
};

export function WorkspaceShareDialog({ open, shareUrl, loading, error, notice, onClose }: WorkspaceShareDialogProps) {
  const titleId = useId();
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (open) {
      setCopyStatus('');
    }
  }, [open, shareUrl]);

  if (!open) {
    return null;
  }

  const copyLink = async () => {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('Link copied');
    } catch {
      setCopyStatus('Copy failed. Select the link and copy it manually.');
    }
  };

  return createPortal(
    <div className="modal-backdrop share-backdrop" role="presentation">
      <section className="share-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Encrypted Snapshot</p>
            <h2 id={titleId}>Encrypted Share Link</h2>
          </div>
          <button className="icon-button" title="Close" aria-label="Close share dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="share-warning">
          <Link2 size={16} />
          <span>This link contains the decryption key. Anyone with the link can open this workspace snapshot.</span>
        </div>

        {loading ? <p className="share-status">Creating encrypted link...</p> : null}
        {notice ? <p className="share-status">{notice}</p> : null}
        {error ? <p className="share-error">{error}</p> : null}

        <label className="share-url-field">
          Share URL
          <textarea value={shareUrl} readOnly rows={5} aria-label="Share URL" />
        </label>

        <div className="share-link-meta">
          <span>{shareUrl ? `${shareUrl.length.toLocaleString()} characters` : 'No link generated yet'}</span>
          <span>{copyStatus || 'Use Copy Link, or select the URL manually if clipboard access is blocked.'}</span>
        </div>

        <div className="modal-actions">
          <button className="primary-button" onClick={copyLink} disabled={!shareUrl || loading}>
            <Copy size={15} />
            Copy Link
          </button>
          <button className="secondary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
