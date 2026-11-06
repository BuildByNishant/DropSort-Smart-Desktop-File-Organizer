import { useApp } from '../hooks/AppContext.jsx';

const STEPS = ['Choose folder', 'Scan', 'Review', 'Organize'];

// A friendly progress tracker for the main workflow.
export default function Stepper() {
  const { page, organizing, scan, sourceFolder } = useApp();
  let current = 0;
  if (page === 'summary') current = 4;
  else if (organizing) current = 3;
  else if (page === 'preview' || scan) current = 2;
  else if (sourceFolder) current = 1;

  return (
    <ol className="mb-6 flex items-center" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? 'step' : undefined}>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                done ? 'bg-ok text-white' : active ? 'bg-accent text-accentink ring-4 ring-accent/20' : 'bg-surface2 text-muted'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`ml-2 whitespace-nowrap text-sm ${active ? 'font-semibold' : done ? 'text-ink' : 'text-muted'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`mx-3 h-0.5 flex-1 rounded ${done ? 'bg-ok' : 'bg-line'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
