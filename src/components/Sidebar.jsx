import { useApp } from '../hooks/AppContext.jsx';
import Logo from './Logo.jsx';

const GROUPS = [
  {
    title: 'Organize',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
      { id: 'organizer', label: 'Organizer', icon: '🗂️' },
      { id: 'results', label: 'Scan Results', icon: '📋' },
      { id: 'preview', label: 'Preview', icon: '👁️' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'rules', label: 'Smart Rules', icon: '🧠' },
      { id: 'categories', label: 'Categories', icon: '🏷️' },
      { id: 'duplicates', label: 'Duplicates', icon: '🔁' },
    ],
  },
  {
    title: 'Library',
    items: [
      { id: 'history', label: 'History', icon: '🕘' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar() {
  const { page, navigate, scan, settings } = useApp();
  const activeRules = settings ? settings.rules.filter((r) => r.enabled).length : 0;

  return (
    <aside className="drag flex w-60 shrink-0 flex-col border-r border-line bg-sidebar px-3 pb-4 pt-11">
      <div className="mb-4 flex items-center gap-2.5 px-2">
        <Logo />
        <div>
          <div className="text-base font-semibold leading-tight tracking-tight">DropSort</div>
          <div className="text-xs text-muted">Smart file organizer</div>
        </div>
      </div>
      <nav aria-label="Main" className="no-drag flex flex-1 flex-col gap-3 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</div>
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = page === item.id;
                const count = item.id === 'results' && scan ? scan.files.length : item.id === 'rules' && activeRules ? activeRules : null;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${active ? 'bg-accent text-accentink shadow-sm' : 'text-ink hover:bg-surface2'}`}
                  >
                    <span aria-hidden="true" className="w-5 text-center">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {count != null && (
                      <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? 'bg-white/25' : 'bg-surface2 text-muted'}`}>{count.toLocaleString()}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="no-drag mt-3 space-y-1 px-2 text-xs text-muted">
        <p><kbd className="rounded bg-surface2 px-1">⌘O</kbd> choose folder · <kbd className="rounded bg-surface2 px-1">⌘,</kbd> settings</p>
        <p>🔒 Works offline. Your files never leave this Mac.</p>
      </div>
    </aside>
  );
}
