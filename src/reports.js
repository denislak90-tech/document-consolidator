import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export function csvCell(value) {
  let text = String(value ?? '');
  // Neutralise spreadsheet formula injection, including leading whitespace.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function inventoryCsv(report) {
  const columns = ['id', 'source', 'path', 'size', 'modified', 'sha256', 'family'];
  return [columns.map(csvCell).join(','), ...report.files.map(file => columns.map(column => csvCell(file[column])).join(','))].join('\r\n') + '\r\n';
}
export function reviewHtml(report) {
  const e = escapeHtml;
  const byId = new Map(report.files.map(file => [file.id, file]));
  const items = ids => ids.map(id => {
    const file = byId.get(id);
    return '<li><code>' + e(file.source + '/' + file.path) + '</code> · ' + e(file.size) + ' bytes</li>';
  }).join('');
  const cards = (groups, kind) => groups.length ? groups.map((group, index) => '<article><h3>' + e(kind + ' ' + (index + 1)) + '</h3><p>' + e(group.family || 'Identical SHA-256 and byte size') + '</p><ul>' + items(group.fileIds) + '</ul><p class="muted">' + e(group.reason || 'No preferred copy selected. Review locations before taking action.') + '</p></article>').join('') : '<p class="muted">No groups found.</p>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>Document consolidation review</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f6f3eb;color:#202823;margin:0}main{max-width:1000px;margin:auto;padding:32px 20px}h1{font-size:clamp(2rem,5vw,3rem);line-height:1.15}h2{margin-top:36px}.muted{color:#56645c}.metrics{display:flex;flex-wrap:wrap;gap:16px}.metric,article{background:white;border:1px solid #d8dfd7;border-radius:12px;padding:18px;margin:12px 0}.metric strong{display:block;font-size:1.8rem}code{overflow-wrap:anywhere}ul{padding-left:22px}table{border-collapse:collapse;width:100%;font-size:.9rem}td,th{text-align:left;border-bottom:1px solid #d8dfd7;padding:10px;overflow-wrap:anywhere}.table-wrap{overflow-x:auto}footer{margin-top:32px}</style></head><body><main><p class="muted">LOCAL REVIEW · READ ONLY</p><h1>Find the copies that need a decision.</h1><p>No source files were moved, renamed or deleted. Similar names are hints, not proof of which version governs.</p><div class="metrics">' + [
    ['Files',report.summary.files],['Duplicate groups',report.summary.duplicateGroups],['Possible redundant bytes',report.summary.redundantBytes],['Version review groups',report.summary.reviewGroups],['Read errors',report.summary.errors]
  ].map(([label,value]) => '<div class="metric"><strong>' + e(value) + '</strong>' + e(label) + '</div>').join('') + '</div><h2>Exact duplicates</h2>' + cards(report.duplicates,'Duplicate group') + '<h2>Possible versions</h2>' + cards(report.review,'Review group') + '<h2>Inventory</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Relative path</th><th>Bytes</th></tr></thead><tbody>' + report.files.map(file => '<tr><td>' + e(file.source) + '</td><td><code>' + e(file.path) + '</code></td><td>' + e(file.size) + '</td></tr>').join('') + '</tbody></table></div><h2>Errors and skipped links</h2><ul>' + [...report.errors,...report.skipped].map(issue => '<li><code>' + e(issue.source + '/' + issue.path) + '</code>: ' + e(issue.reason) + '</li>').join('') + '</ul><footer class="muted">Reports can contain confidential filenames, relative paths, timestamps and content hashes. Keep them private. Generated ' + e(report.generatedAt) + '.</footer></main></body></html>';
}
export async function writeReports(report, output) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'inventory.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  await writeFile(path.join(output, 'inventory.csv'), inventoryCsv(report), { mode: 0o600 });
  await writeFile(path.join(output, 'review.html'), reviewHtml(report), { mode: 0o600 });
}
