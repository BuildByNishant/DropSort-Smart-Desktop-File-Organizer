export default function ProgressBar({ value = 0, max = 0, label, detail }) {
  const indeterminate = !max;
  const pct = indeterminate ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div role="status" aria-live="polite">
      <div className="mb-1 flex justify-between gap-3 text-xs text-muted">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{indeterminate ? detail : `${pct}%`}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max || undefined}
        aria-valuenow={indeterminate ? undefined : value}
      >
        {indeterminate ? (
          <div className="indeterminate-bar h-full rounded-full bg-accent" />
        ) : (
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        )}
      </div>
      {!indeterminate && detail && <div className="mt-1 truncate text-xs text-muted">{detail}</div>}
    </div>
  );
}
