import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_EXCLUDES = new Set(['.git', 'node_modules', 'reports', 'coverage']);
const DEFAULT_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.doc', '.docx', '.rtf', '.odt', '.csv', '.xlsx', '.xls', '.pptx', '.ppt', '.html', '.json']);
const within = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

/** Filename similarity is a review hint, never a version-authority decision. */
export function familyKey(filename) {
  const extension = path.extname(filename).toLowerCase();
  let stem = path.basename(filename, path.extname(filename)).toLowerCase();
  let previous;
  do {
    previous = stem;
    stem = stem.replace(/(?:[ _-]+(?:copy|final|draft|revised|revision|v\d+(?:\.\d+)*|version[ _-]*\d+)|[ _-]*\(\d+\)|[ _-]*\(copy\))[ _-]*$/i, '');
  } while (stem !== previous);
  return stem.replace(/[ _-]+/g, ' ').trim() + extension;
}

async function hashFile(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export async function canonicalPath(input) {
  let cursor = path.resolve(input), suffix = [];
  while (true) {
    try { await lstat(cursor); return path.join(await realpath(cursor), ...suffix.reverse()); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      suffix.push(path.basename(cursor)); cursor = parent;
    }
  }
}

/** Read-only. Sources and reports stay local; root labels avoid absolute paths. */
export async function scan(roots, { includeHidden = false, allFiles = false, excludePaths = [] } = {}) {
  if (!Array.isArray(roots) || roots.length === 0) throw new Error('Provide at least one source folder.');
  const resolvedRoots = [];
  for (const root of roots) {
    const candidate = path.resolve(root);
    const info = await lstat(candidate);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Each source must be a real directory, not a symlink.');
    resolvedRoots.push(await realpath(candidate));
  }
  const excluded = await Promise.all(excludePaths.map(canonicalPath));
  // A nested root is already covered. Preserve first user-supplied ownership for reporting.
  const uniqueRoots = [...new Set(resolvedRoots)].filter(root => !resolvedRoots.some(other => other !== root && within(root, other)));
  for (const root of uniqueRoots) {
    if (excluded.some(exclusion => within(root, exclusion))) throw new Error('Output/excluded folder cannot contain a source folder.');
  }
  const records = [], errors = [], skipped = [];
  const visited = new Set();
  let nextId = 1;
  async function walk(directory, root, label) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch { errors.push({ source: label, path: path.relative(root, directory).split(path.sep).join('/'), reason: 'Cannot read directory' }); return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(root, filename).split(path.sep).join('/');
      if (excluded.some(exclusion => within(filename, exclusion))) continue;
      if (DEFAULT_EXCLUDES.has(entry.name) || (!includeHidden && entry.name.startsWith('.'))) continue;
      try {
        const before = await lstat(filename, { bigint: true });
        if (before.isSymbolicLink()) { skipped.push({ source: label, path: relative, reason: 'Symlink skipped' }); continue; }
        if (before.isDirectory()) { await walk(filename, root, label); continue; }
        if (!before.isFile() || (!allFiles && !DEFAULT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))) continue;
        const canonical = await realpath(filename);
        // Check again after discovery; reject a path redirected outside the selected root.
        if (!within(canonical, root)) { skipped.push({ source: label, path: relative, reason: 'Outside source root' }); continue; }
        if (visited.has(canonical)) continue;
        visited.add(canonical);
        const digest = await hashFile(filename);
        const after = await lstat(filename, { bigint: true });
        if (!after.isFile() || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs || before.ino !== after.ino) {
          errors.push({ source: label, path: relative, reason: 'File changed during scan; excluded from duplicate decisions' }); continue;
        }
        if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('File size exceeds supported range');
        records.push({ id: 'file-' + nextId++, source: label, path: relative, name: entry.name, size: Number(before.size), modified: new Date(Number(before.mtimeMs)).toISOString(), sha256: digest, family: familyKey(entry.name) });
      } catch {
        errors.push({ source: label, path: relative, reason: 'Cannot safely read file' });
      }
    }
  }
  for (const [index, root] of uniqueRoots.entries()) await walk(root, root, 'source-' + (index + 1));
  return analyse(records, { errors, skipped, sourceCount: uniqueRoots.length });
}

export function analyse(records, { errors = [], skipped = [], sourceCount = 1 } = {}) {
  const hashes = new Map(), families = new Map();
  for (const record of records) {
    const key = record.size + ':' + record.sha256;
    if (!hashes.has(key)) hashes.set(key, []);
    hashes.get(key).push(record);
    if (!families.has(record.family)) families.set(record.family, []);
    families.get(record.family).push(record);
  }
  const duplicates = [...hashes.values()].filter(group => group.length > 1).map(group => ({
    sha256: group[0].sha256, size: group[0].size, fileIds: group.map(record => record.id),
    redundantBytes: group[0].size * (group.length - 1)
  }));
  const review = [...families.entries()].filter(([, group]) => new Set(group.map(record => record.sha256)).size > 1).map(([family, group]) => ({
    family, fileIds: group.map(record => record.id), reason: 'Similar filenames with different bytes; human review required'
  }));
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    summary: { sources: sourceCount, files: records.length, bytes: records.reduce((sum, record) => sum + record.size, 0), duplicateGroups: duplicates.length, redundantBytes: duplicates.reduce((sum, group) => sum + group.redundantBytes, 0), reviewGroups: review.length, errors: errors.length, skipped: skipped.length },
    files: records, duplicates, review, errors, skipped
  };
}
