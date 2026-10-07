import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scan, familyKey } from '../src/scanner.js';
import { csvCell, inventoryCsv, reviewHtml } from '../src/reports.js';
import { parseArgs } from '../bin/document-consolidator.js';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'consolidator-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, name, content) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), content);
}
test('identical bytes across renamed files form one duplicate group', async t => {
  const root = await fixture(t);
  await put(root,'one.txt','shared'); await put(root,'nested/different.txt','shared');
  const r = await scan([root]);
  assert.equal(r.duplicates.length,1); assert.equal(r.duplicates[0].redundantBytes,6);
});
test('same filename and size with different bytes is not a duplicate', async t => {
  const root = await fixture(t);
  await put(root,'a/guide.txt','aaaa'); await put(root,'b/guide.txt','bbbb');
  const r = await scan([root]);
  assert.equal(r.duplicates.length,0); assert.equal(r.review.length,1);
});
test('suffix hints flag revisions without choosing a winner', async t => {
  const root = await fixture(t);
  await put(root,'Guide.txt','original'); await put(root,'Guide v2.txt','revision');
  const r = await scan([root]);
  assert.equal(r.review.length,1); assert.equal(r.review[0].fileIds.length,2);
  assert.equal(Object.hasOwn(r.review[0],'preferred'),false);
});
test('normalisation handles stacked copy suffixes and preserves extensions', () => {
  assert.equal(familyKey('Supplier Guide v2 (copy).txt'),'supplier guide.txt');
  assert.notEqual(familyKey('guide.pdf'),familyKey('guide.docx'));
});
test('overlapping and repeated roots are counted once', async t => {
  const root = await fixture(t); await put(root,'child/a.txt','data');
  const r = await scan([path.join(root,'child'),root,root]);
  assert.equal(r.files.length,1); assert.equal(r.summary.sources,1);
});
test('root aliases do not disclose absolute paths', async t => {
  const root = await fixture(t); await put(root,'a.txt','data');
  const r = await scan([root]);
  assert.equal(r.files[0].source,'source-1');
  assert.equal(JSON.stringify(r).includes(root),false);
});
test('hidden files and dependencies are skipped by default', async t => {
  const root = await fixture(t);
  await put(root,'.env.txt','secret'); await put(root,'.git/a.txt','secret');
  await put(root,'node_modules/a.txt','secret'); await put(root,'normal.txt','safe');
  const r = await scan([root]); assert.equal(r.files.length,1);
  const expanded = await scan([root],{includeHidden:true}); assert.equal(expanded.files.length,2);
});
test('extension filter can be explicitly expanded', async t => {
  const root = await fixture(t); await put(root,'a.bin','binary');
  assert.equal((await scan([root])).files.length,0);
  assert.equal((await scan([root],{allFiles:true})).files.length,1);
});
test('report directories inside a source are excluded', async t => {
  const root = await fixture(t);
  await put(root,'input.txt','data'); await put(root,'output/inventory.json','old report');
  const r = await scan([root],{excludePaths:[path.join(root,'output')]});
  assert.equal(r.files.length,1);
});
test('output cannot contain a source folder', async t => {
  const root = await fixture(t); await put(root,'a.txt','data');
  await assert.rejects(scan([root],{excludePaths:[root]}));
});
test('symlinked directories are not followed', async t => {
  const root = await fixture(t); await put(root,'real/a.txt','data');
  try {await symlink(path.join(root,'real'),path.join(root,'link'),process.platform==='win32'?'junction':'dir');}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Symlinks unavailable');return;}throw error;}
  const r = await scan([root]); assert.equal(r.files.length,1); assert.equal(r.skipped.length,1);
  await assert.rejects(scan([path.join(root,'link')]));
});
test('empty files are valid exact duplicates', async t => {
  const root = await fixture(t); await put(root,'a.txt',''); await put(root,'b.txt','');
  const r = await scan([root]); assert.equal(r.duplicates.length,1); assert.equal(r.summary.redundantBytes,0);
});
test('HTML escapes malicious filenames and has no executable scripts', async t => {
  const root = await fixture(t); await put(root,'normal.txt','data');
  const r = await scan([root]); r.files[0].path='<img src=x onerror=alert(1)>';
  const html=reviewHtml(r);
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img src=x')); assert.ok(!html.includes('<script'));
  assert.ok(html.includes('Content-Security-Policy'));
});
test('CSV quotes delimiters and neutralises spreadsheet formulas', () => {
  assert.equal(csvCell('=SUM(1,2)'),'"\'=SUM(1,2)"');
  assert.equal(csvCell('  +command'),'"\'  +command"');
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
});
test('scanning leaves source bytes unchanged', async t => {
  const root=await fixture(t); await put(root,'a.txt','unchanged');
  await scan([root]); assert.equal(await readFile(path.join(root,'a.txt'),'utf8'),'unchanged');
});
test('CLI generates all reports from synthetic data', async t => {
  const root=await fixture(t); const out=path.join(root,'output'); const input=path.join(root,'input');
  await put(input,'a.txt','same'); await put(input,'b.txt','same');
  const result=spawnSync(process.execPath,['bin/document-consolidator.js',input,'--out',out],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const r=JSON.parse(await readFile(path.join(out,'inventory.json'),'utf8'));
  assert.equal(r.summary.duplicateGroups,1);
  assert.ok((await readFile(path.join(out,'review.html'),'utf8')).includes('Exact duplicates'));
  assert.ok(inventoryCsv(r).startsWith('"id"'));
});
test('CLI handles paths containing spaces', async t => {
  const root=await fixture(t); const input=path.join(root,'source folder'); await put(input,'a.txt','data');
  const result=spawnSync(process.execPath,['bin/document-consolidator.js',input,'--out',path.join(root,'report folder')],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
test('invalid input fails without echoing private absolute paths', () => {
  const input=path.join(os.tmpdir(),'missing-consolidator-source-000000');
  const result=spawnSync(process.execPath,['bin/document-consolidator.js',input],{cwd:path.resolve(import.meta.dirname,'..'),encoding:'utf8'});
  assert.equal(result.status,1); assert.ok(!result.stderr.includes(input));
});
test('argument errors are rejected', () => {
  assert.throws(()=>parseArgs(['--out'])); assert.throws(()=>parseArgs(['--unknown']));
  assert.equal(parseArgs(['--help']).help,true);
});

test('output exclusion resolves directory aliases', async t => {
  const root = await fixture(t); const output=path.join(root,'actual-output');
  await put(root,'a.txt','data'); await put(output,'old.json','private report');
  const alias=path.join(root,'output-alias');
  try {await symlink(output,alias,process.platform==='win32'?'junction':'dir');}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code)){t.skip('Symlinks unavailable');return;}throw error;}
  const r=await scan([root],{excludePaths:[alias]});
  assert.equal(r.files.length,1);
});
