import { useMemo } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { computeInsights } from '../utils/insights.js';
import { RULE_PRESETS } from '../utils/rulePresets.js';
import { formatBytes } from '../utils/format.js';
import { categoryMeta } from '../utils/categories.js';
import Button from './Button.jsx';
import Card from './Card.jsx';

function Gauge({ score, level }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const color = score < 25 ? 'var(--ok)' : score < 55 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`Clutter score ${score} out of 100: ${level}`}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 48 48)" />
        <text x="48" y="53" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--ink)">{score}</text>
      </svg>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Clutter score</div>
        <div className="text-lg font-semibold" style={{ color }}>{level}</div>
        <div className="text-xs text-muted">Lower is tidier</div>
      </div>
    </div>
  );
}

// Folder insights: a clutter score, where the space goes, and one-click suggestions.
export default function InsightsPanel() {
  const { scan, settings, addPreset } = useApp();
  const existing = useMemo(() => new Set((settings.rules || []).map((r) => r.presetId).filter(Boolean)), [settings.rules]);
  const insights = useMemo(() => computeInsights(scan.files, { existingPresets: existing }), [scan.files, existing]);
  const cats = Object.entries(insights.byCategory).sort((a, b) => b[1].size - a[1].size);
  const sizeTotal = insights.totalSize || 1;

  return (
    <Card className="mb-4">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
        <Gauge score={insights.score} level={insights.level} />

        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Where the space goes</h3>
            <span className="text-xs text-muted">{formatBytes(insights.totalSize)} total</span>
          </div>
          {insights.totalSize > 0 ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-surface2" role="img" aria-label="Storage by category">
                {cats.map(([name, v]) => (
                  <div key={name} title={`${name}: ${formatBytes(v.size)}`} style={{ width: `${(v.size / sizeTotal) * 100}%`, backgroundColor: categoryMeta(name).color }} />
                ))}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {cats.slice(0, 6).map(([name, v]) => (
                  <li key={name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoryMeta(name).color }} />
                    <span className="truncate">{name}</span>
                    <span className="ml-auto tabular-nums text-muted">{formatBytes(v.size)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">These files are all empty.</p>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold">Suggestions</h3>
          {insights.tips.length === 0 ? (
            <p className="text-sm text-muted">Nothing to suggest. Your rules already cover what we found.</p>
          ) : (
            <ul className="space-y-2">
              {insights.tips.slice(0, 3).map((tip) => (
                <li key={tip.presetId} className="flex items-start justify-between gap-3 rounded-lg bg-surface2 px-3 py-2 text-xs">
                  <span>{tip.text}</span>
                  <Button size="sm" variant="primary" onClick={() => addPreset(RULE_PRESETS.find((p) => p.presetId === tip.presetId))}>Add rule</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {insights.largest.length > 0 && insights.largest[0].size > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">Biggest files</summary>
          <ul className="mt-2 divide-y divide-line">
            {insights.largest.filter((f) => f.size > 0).map((f) => (
              <li key={f.id} className="flex justify-between gap-3 py-1.5">
                <span className="truncate" title={f.path}>{f.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
