import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, X } from 'lucide-react';

type ConfirmDialogVariant = 'danger' | 'info';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  showCancel?: boolean;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  eyebrow = 'Confirm Action',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  showCancel = true,
  checkboxLabel,
  checkboxChecked = false,
  onCheckboxChange,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const Icon = variant === 'danger' ? AlertTriangle : Info;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
      if (event.key === 'Enter' && !isEditableTarget(event.target)) {
        event.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onConfirm, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop confirm-backdrop" role="presentation">
      <section
        className={`confirm-modal is-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="confirm-icon" aria-hidden="true">
          <Icon size={22} />
        </div>
        <div className="confirm-content">
          <div className="modal-heading confirm-heading">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 id={titleId}>{title}</h2>
            </div>
            {showCancel ? (
              <button className="icon-button" title="Close" aria-label="Close dialog" onClick={onCancel}>
                <X size={16} />
              </button>
            ) : null}
          </div>
          <p id={messageId} className="confirm-message">
            {message}
          </p>
          {checkboxLabel ? (
            <label className="confirm-checkbox">
              <input
                type="checkbox"
                checked={checkboxChecked}
                onChange={(event) => onCheckboxChange?.(event.target.checked)}
              />
              {checkboxLabel}
            </label>
          ) : null}
          <div className="modal-actions confirm-actions">
            <button className={variant === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>
              {confirmLabel}
            </button>
            {showCancel ? (
              <button className="secondary-button" onClick={onCancel}>
                {cancelLabel}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
