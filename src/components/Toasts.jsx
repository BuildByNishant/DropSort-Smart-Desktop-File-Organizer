const TONES = { info: 'border-line', success: 'border-ok', error: 'border-bad' };

export default function Toasts({ toasts }) {
  return (
    <div className="no-drag pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto rounded-lg border-l-4 bg-surface px-3 py-2 text-sm shadow-lg ring-1 ring-line ${TONES[t.kind] || TONES.info}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
