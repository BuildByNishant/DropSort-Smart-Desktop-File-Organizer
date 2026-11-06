import { useEffect } from 'react';
import Button from './Button.jsx';

export default function ConfirmDialog({
  open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h3 id="dialog-title" className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={busy} autoFocus>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
