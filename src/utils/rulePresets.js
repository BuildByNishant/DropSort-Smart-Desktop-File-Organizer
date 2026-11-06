export const RULE_PRESETS = [
  { presetId: 'screenshots', name: 'Screenshots', field: 'name', op: 'contains', value: 'screenshot, screen shot', folder: 'Screenshots', blurb: 'Keeps screen captures out of your Images folder.' },
  { presetId: 'invoices', name: 'Invoices & receipts', field: 'name', op: 'contains', value: 'invoice, receipt', folder: 'Invoices', blurb: 'Finds files with "invoice" or "receipt" in the name.' },
  { presetId: 'installers', name: 'Installers', field: 'extension', op: 'is', value: 'dmg, pkg', folder: 'Installers', blurb: 'App installers you can usually delete later.' },
  { presetId: 'large', name: 'Large files', field: 'size', op: 'largerThan', value: 500, folder: 'Large Files', blurb: 'Anything over 500 MB, so big files are easy to find.' },
  { presetId: 'old', name: 'Old files', field: 'age', op: 'olderThan', value: 365, folder: 'Old Files', blurb: 'Files not changed for over a year, ready to archive.' },
];

export const FIELDS = [
  { id: 'name', label: 'File name', ops: [['contains', 'contains'], ['startsWith', 'starts with'], ['endsWith', 'ends with']], hint: 'Separate several words with commas' },
  { id: 'extension', label: 'File type', ops: [['is', 'is one of']], hint: 'For example: dmg, pkg' },
  { id: 'size', label: 'Size', ops: [['largerThan', 'is larger than']], hint: 'In megabytes (MB)' },
  { id: 'age', label: 'Last changed', ops: [['olderThan', 'is older than']], hint: 'In days' },
];

export function newRuleId() {
  return `r-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function ruleFromPreset(preset) {
  const { blurb, ...rest } = preset;
  return { id: newRuleId(), enabled: true, ...rest };
}

export function describeRule(rule) {
  const field = FIELDS.find((f) => f.id === rule.field);
  const op = field?.ops.find(([id]) => id === rule.op)?.[1] || rule.op;
  const unit = rule.field === 'size' ? ' MB' : rule.field === 'age' ? ' days' : '';
  return `${field?.label || rule.field} ${op} ${String(rule.value).split(',').map((v) => v.trim()).join(', ')}${unit}`;
}
