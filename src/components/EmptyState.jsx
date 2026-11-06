export default function EmptyState({ icon = '📂', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <div className="text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
