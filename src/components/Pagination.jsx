import Button from './Button.jsx';

export default function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
      <span className="tabular-nums">{from.toLocaleString()}-{to.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Previous page">Previous</Button>
        <span className="tabular-nums">Page {page + 1} / {pages}</span>
        <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label="Next page">Next</Button>
      </div>
    </div>
  );
}
