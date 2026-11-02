// RFC-4180-like parser for UTF-8 CSV with quotes, escaped quotes and CRLF.
// Headers: studentId,name,room,familyId
export function parseCSV(text) {
  const rows = [];
  let current = '', row = [], quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { current += '"'; i++; }
      else if (quoted || current === '') quoted = !quoted;
      else current += ch;
    } else if (ch === ',' && !quoted) { row.push(current); current = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(current); if (row.some(x => x.trim())) rows.push(row);
      row = []; current = '';
    } else current += ch;
  }
  if (quoted) throw new Error('CSV มีเครื่องหมายอัญประกาศไม่ครบ');
  if (current || row.length) { row.push(current); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().replace(/^\uFEFF/, ''));
  const required = ['studentId', 'name', 'room', 'familyId'];
  if (!required.every(h => headers.includes(h))) throw new Error(`หัวคอลัมน์ต้องเป็น ${required.join(',')}`);
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}
export function csvEscape(value) {
  const s = String(value ?? '');
  // Also prevent CSV formula injection in exported spreadsheet files.
  const guarded = /^[=+@\-\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}
export function toCSV(headers, rows) {
  return '\uFEFF' + [headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\r\n');
}
export function saveText(filename, content, mime = 'text/csv;charset=utf-8;') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}