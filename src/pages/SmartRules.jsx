import { useMemo, useState } from 'react';
import { useApp } from '../hooks/AppContext.jsx';
import { FIELDS, RULE_PRESETS, describeRule, newRuleId, ruleFromPreset } from '../utils/rulePresets.js';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import PageHeader from '../components/PageHeader.jsx';

const blank = () => ({ id: newRuleId(), name: '', enabled: true, field: 'name', op: 'contains', value: '', folder: '' });
const inputCls = 'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm';

function RuleForm({ initial, onSave, onCancel, submitLabel }) {
  const [rule, setRule] = useState(initial);
  const field = FIELDS.find((f) => f.id === rule.field);
  const numeric = rule.field === 'size' || rule.field === 'age';

  function changeField(id) {
    const f = FIELDS.find((x) => x.id === id);
    setRule((r) => ({ ...r, field: id, op: f.ops[0][0], value: '' }));
  }
  const ready = rule.name.trim() && String(rule.value).trim() && rule.folder.trim();

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-muted">Rule name
          <input className={`${inputCls} mt-1 w-full`} value={rule.name} maxLength={60} onChange={(e) => setRule({ ...rule, name: e.target.value })} placeholder="e.g. Tax documents" />
        </label>
        <label className="text-xs font-medium text-muted">Move matching files to this folder
          <input className={`${inputCls} mt-1 w-full`} value={rule.folder} maxLength={60} onChange={(e) => setRule({ ...rule, folder: e.target.value })} placeholder="e.g. Taxes" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        <label className="text-xs font-medium text-muted">When the file's
          <select className={`${inputCls} mt-1 w-full`} value={rule.field} onChange={(e) => changeField(e.target.value)}>
            {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">Condition
          <select className={`${inputCls} mt-1 w-full`} value={rule.op} onChange={(e) => setRule({ ...rule, op: e.target.value })}>
            {field.ops.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">Value <span className="font-normal">({field.hint})</span>
          <input className={`${inputCls} mt-1 w-full`} type={numeric ? 'number' : 'text'} min={numeric ? 1 : undefined} value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" disabled={!ready} onClick={() => onSave({ ...rule, name: rule.name.trim(), folder: rule.folder.trim() })}>{submitLabel}</Button>
      </div>
    </div>
  );
}

export default function SmartRules() {
  const { settings, saveSettings, scan, toast, addPreset } = useApp();
  const [editing, setEditing] = useState(null); // rule id, or 'new'
  const rules = settings.rules;
  const existing = useMemo(() => new Set(rules.map((r) => r.presetId).filter(Boolean)), [rules]);

  const matchCounts = useMemo(() => {
    const c = {};
    if (scan) for (const f of scan.files) if (f.ruleId) c[f.ruleId] = (c[f.ruleId] || 0) + 1;
    return c;
  }, [scan]);

  async function commit(next, message) {
    try {
      await saveSettings({ rules: next });
      if (message) toast(message, 'success');
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    }
  }
  const move = (i, d) => {
    const next = [...rules];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    commit(next);
  };
  const toggle = (i) => commit(rules.map((r, k) => (k === i ? { ...r, enabled: !r.enabled } : r)));
  const remove = (i) => commit(rules.filter((_, k) => k !== i), 'Rule deleted.');

  async function save(rule) {
    const exists = rules.some((r) => r.id === rule.id);
    const next = exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule];
    if (await commit(next, exists ? 'Rule updated.' : 'Rule added.')) setEditing(null);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Smart Rules"
        subtitle="Teach DropSort your own habits. Rules run before the normal file-type sorting, from top to bottom, and the first rule that matches wins."
        actions={editing !== 'new' && <Button variant="primary" onClick={() => setEditing('new')}>New rule</Button>}
      />

      {editing === 'new' && <div className="mb-4"><RuleForm initial={blank()} submitLabel="Add rule" onSave={save} onCancel={() => setEditing(null)} /></div>}

      <Card title={`Your rules (${rules.length})`} className="mb-5">
        {rules.length === 0 ? (
          <p className="text-sm text-muted">No rules yet. Add a ready-made one below, or create your own. Without rules, files are sorted by type.</p>
        ) : (
          <ul className="space-y-2">
            {rules.map((r, i) => (
              <li key={r.id}>
                {editing === r.id ? (
                  <RuleForm initial={r} submitLabel="Save changes" onSave={save} onCancel={() => setEditing(null)} />
                ) : (
                  <div className={`flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 ${r.enabled ? 'bg-surface' : 'bg-surface2 opacity-70'}`}>
                    <input type="checkbox" checked={r.enabled} onChange={() => toggle(i)} aria-label={`Turn ${r.name} on or off`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.name}</span>
                        {scan && r.enabled && <span className="rounded bg-accent/15 px-1.5 text-xs text-accent">{matchCounts[r.id] || 0} match{(matchCounts[r.id] || 0) === 1 ? '' : 'es'} in this scan</span>}
                      </div>
                      <div className="truncate text-xs text-muted">{describeRule(r)} → <span className="font-medium text-ink">{r.folder}</span></div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`}>↑</Button>
                      <Button size="sm" variant="ghost" disabled={i === rules.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`}>↓</Button>
                      <Button size="sm" onClick={() => setEditing(r.id)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(i)} aria-label={`Delete ${r.name}`}>Delete</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {rules.length > 0 && scan && <p className="mt-3 text-xs text-muted">Changes apply to your current scan straight away. Check the Preview before organizing.</p>}
      </Card>

      <Card title="Ready-made rules">
        <div className="grid gap-3 sm:grid-cols-2">
          {RULE_PRESETS.map((p) => {
            const added = existing.has(p.presetId);
            return (
              <div key={p.presetId} className="flex flex-col justify-between rounded-xl border border-line p-3">
                <div>
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{p.blurb}</div>
                  <div className="mt-1 text-xs text-muted">{describeRule(p)} → {p.folder}</div>
                </div>
                <Button size="sm" className="mt-3 self-start" disabled={added} onClick={() => addPreset(p)}>{added ? 'Added' : 'Add this rule'}</Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
