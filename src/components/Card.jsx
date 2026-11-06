export default function Card({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}
