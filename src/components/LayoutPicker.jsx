import { LAYOUT_OPTIONS } from '../utils/layouts.js';

// "Sorting style": how files are arranged inside the destination.
export default function LayoutPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Sorting style" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {LAYOUT_OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`card-lift rounded-xl border p-3 text-left ${active ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-line bg-surface'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{o.title}</span>
              {active && <span className="text-xs font-medium text-accent">Selected</span>}
            </div>
            <div className="mt-1 truncate font-mono text-xs text-muted">{o.example}</div>
            <div className="mt-1 text-xs text-muted">{o.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}
