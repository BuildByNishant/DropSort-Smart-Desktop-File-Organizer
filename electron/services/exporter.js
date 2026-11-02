// Spreadsheet-friendly CSV export of a preview or a history session.

// A cell that starts with = + - @ can be run as a formula by Excel/Numbers, so neutralize it.
function cell(value) {
  if (value == null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`; // BOM so Excel reads UTF-8 names correctly
}

function planToCsv(items) {
  return toCsv(
    ['File', 'Category', 'Smart rule', 'Size (bytes)', 'From', 'To', 'Status', 'Note'],
    items.map((i) => [i.name, i.category, i.ruleName || '', i.size, i.source, i.destination, i.status, i.note])
  );
}

function historyToCsv(operations) {
  return toCsv(
    ['File', 'Category', 'Size (bytes)', 'Original location', 'New location', 'Status', 'Message', 'Date'],
    operations.map((o) => [o.file_name, o.category, o.file_size, o.original_path, o.destination_path, o.status, o.error_message, o.created_at])
  );
}

module.exports = { toCsv, planToCsv, historyToCsv, cell };
