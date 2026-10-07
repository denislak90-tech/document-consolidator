#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, canonicalPath } from '../src/scanner.js';
import { writeReports } from '../src/reports.js';

const HELP = `Document Consolidator 0.1.0 — local read-only inventory
Usage: node bin/document-consolidator.js <folder> [folder...] [options]
  --out <folder>       Report directory (default: reports/latest)
  --include-hidden     Include hidden files; .git and dependency folders stay excluded
  --all-files          Include all regular file extensions
  --help               Show help
Reports: inventory.json, inventory.csv, review.html
No network requests. No source moves or deletion. Reports are private local data.
Exit codes: 0 success, 1 invalid input/output failure, 2 partial scan with read errors.
`;

export function parseArgs(args) {
  const options = { roots: [], out: 'reports/latest', includeHidden: false, allFiles: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--include-hidden') options.includeHidden = true;
    else if (arg === '--all-files') options.allFiles = true;
    else if (arg === '--out') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--out requires a folder.');
      options.out = value;
    } else if (arg.startsWith('-')) throw new Error('Unknown option. Use --help.');
    else options.roots.push(arg);
  }
  return options;
}

export async function main(args) {
  try {
    const options = parseArgs(args);
    if (options.help) { console.log(HELP); return 0; }
    const output = await canonicalPath(options.out);
    const report = await scan(options.roots, { ...options, excludePaths: [output] });
    await writeReports(report, output);
    console.log('Scanned ' + report.summary.files + ' files; ' + report.summary.duplicateGroups + ' duplicate groups; ' + report.summary.reviewGroups + ' version review groups.');
    console.log('Created inventory.json, inventory.csv and review.html in the selected report folder.');
    console.log('Source files unchanged. Keep generated reports private.');
    return report.errors.length ? 2 : 0;
  } catch {
    // Avoid echoing absolute paths, environment values or raw filesystem errors.
    console.error('Scan failed. Check source folders, output location and permissions. Use --help for usage.');
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = await main(process.argv.slice(2));
}
