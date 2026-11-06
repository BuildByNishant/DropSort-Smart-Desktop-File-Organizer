import { useEffect } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import Button from './Button.jsx';
import Logo from './Logo.jsx';

const POINTS = [
  ['📂', 'Pick a folder', 'Choose Downloads, Desktop, or drag any folder onto the window.'],
  ['👁️', 'Preview everything', 'See exactly where each file would go. Nothing moves until you say so.'],
  ['🧠', 'Teach it your habits', 'Smart Rules send screenshots, invoices or big files wherever you like.'],
  ['↩️', 'Undo anytime', 'Every move is recorded. Restore one file or a whole session from History.'],
];

export default function Onboarding() {
  const { tourOpen, finishTour } = useApp();
  useEffect(() => {
    if (!tourOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && finishTour();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourOpen, finishTour]);

  if (!tourOpen) return null;
  return (
    <div className="no-drag fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="pop-in w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="hero-gradient flex items-center gap-3 px-6 py-5 text-white">
          <Logo size={44} />
          <div>
            <h2 id="tour-title" className="text-xl font-semibold">Welcome to DropSort</h2>
            <p className="text-sm text-white/80">A calm way to clean up your files.</p>
          </div>
        </div>
        <ul className="space-y-4 px-6 py-5">
          {POINTS.map(([icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="text-2xl" aria-hidden="true">{icon}</span>
              <div><div className="text-sm font-semibold">{title}</div><div className="text-sm text-muted">{text}</div></div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <span className="text-xs text-muted">Everything stays on your Mac. DropSort works offline.</span>
          <Button variant="primary" onClick={finishTour} autoFocus>Get started</Button>
        </div>
      </div>
    </div>
  );
}
