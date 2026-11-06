import { categoryMeta } from '../utils/categories.js';

const TONES = {
  neutral: 'bg-surface2 text-muted',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  accent: 'bg-accent/15 text-accent',
};

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const { icon, color } = categoryMeta(category);
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color, backgroundColor: `${color}22` }}
    >
      <span aria-hidden="true">{icon}</span>
      {category}
    </span>
  );
}

export function statusTone(status) {
  if (status === 'moved' || status === 'ready' || status === 'completed') return 'ok';
  if (status === 'failed') return 'bad';
  if (status === 'partial' || status === 'renamed' || status === 'conflict-skip' || status === 'skipped') return 'warn';
  if (status === 'reversed') return 'accent';
  return 'neutral';
}
