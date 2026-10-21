#!/usr/bin/env node
/**
 * Export a terminated runner's explicitly referenced evidence, never its profile.
 * Confirm the runner process is terminal before invoking this filesystem tool.
 * A final report marker must follow its most recent resume/build session.
 *
 * node scripts/export-three-days-artifacts.mjs --report REPORT.json \
 *   --allowed-root PRIVATE_QA --served-root PRODUCTION --out NEW_PRIVATE_DIR
 * --allowed-root/--served-root/--repository-root may repeat. Served boundaries
 * are mandatory; detected Git repositories also forbid output placement.
 *
 * After moving a bundle, re-export into another empty private directory with
 * --report BUNDLE/report.json --source-manifest BUNDLE/manifest.json. Hashes
 * bind the relocated files before new absolute paths are written for the Gate.
 * Failed reports remain failed. This does not verify gameplay or rerun it.
 */
import {
  chmodSync, closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync,
  openSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export class ExportError extends Error {
  constructor(code, message = code) { super(message); this.code = code; }
}
const need = (condition, code, message) => { if (!condition) throw new ExportError(code, message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const absoluteAny = value => typeof value === 'string' && (path.posix.isAbsolute(value) || path.win32.isAbsolute(value));
const basenameAny = value => path.win32.isAbsolute(value) ? path.win32.basename(value) : path.posix.basename(value);

function within(target, root) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

function rootDirectory(value) {
  const resolved = path.resolve(value);
  let real;
  try { real = realpathSync(resolved); need(statSync(real).isDirectory(), 'ROOT_NOT_DIRECTORY'); }
  catch (error) { if (error instanceof ExportError) throw error; throw new ExportError('ROOT_UNAVAILABLE', 'A declared directory is unavailable.'); }
  return { resolved, real };
}

function permittedFile(value, roots, optional = false) {
  need(typeof value === 'string' && path.isAbsolute(value), 'ARTIFACT_PATH_NOT_ABSOLUTE');
  const resolved = path.resolve(value);
  need(roots.some(root => within(resolved, root.resolved)), 'PATH_OUTSIDE_ALLOWED_ROOT');
  let real;
  try { real = realpathSync(resolved); }
  catch (error) {
    if (optional && error.code === 'ENOENT') {
      try { need(!lstatSync(resolved).isSymbolicLink(), 'UNRESOLVED_ARTIFACT_SYMLINK'); }
      catch (missing) { if (missing.code === 'ENOENT') return null; throw missing; }
    }
    throw new ExportError('ARTIFACT_UNAVAILABLE', 'An explicitly referenced artifact is unavailable.');
  }
  need(roots.some(root => within(real, root.real)), 'SYMLINK_OUTSIDE_ALLOWED_ROOT');
  need(statSync(real).isFile(), 'ARTIFACT_NOT_REGULAR_FILE');
  return real;
}

function readBytes(filename) {
  const descriptor = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try { need(fstatSync(descriptor).isFile(), 'ARTIFACT_NOT_REGULAR_FILE'); return readFileSync(descriptor); }
  finally { closeSync(descriptor); }
}

function json(bytes, code) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new ExportError(code); }
}

function fnv(payload) {
  let hash = 2166136261;
  const text = JSON.stringify(payload);
  for (let index = 0; index < text.length; index++) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

function detectedRepositoryRoots() {
  const roots = new Set();
  for (const start of [process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) {
    let directory = path.resolve(start);
    while (true) {
      if (existsSync(path.join(directory, '.git'))) { roots.add(directory); break; }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return [...roots];
}

function futureRealPath(value) {
  let ancestor = path.resolve(value);
  const suffix = [];
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    need(parent !== ancestor, 'OUTPUT_PARENT_UNAVAILABLE');
    suffix.unshift(path.basename(ancestor)); ancestor = parent;
  }
  need(statSync(ancestor).isDirectory(), 'OUTPUT_PARENT_NOT_DIRECTORY');
  return path.join(realpathSync(ancestor), ...suffix);
}

function validateOutput(out, forbidden) {
  const resolved = path.resolve(out);
  const real = futureRealPath(resolved);
  need(!forbidden.some(root => within(resolved, root.resolved) || within(real, root.real)),
    'OUTPUT_INSIDE_SERVED_OR_REPOSITORY_ROOT', 'Export into a private directory outside production and repository roots.');
  if (existsSync(resolved)) {
    need(!lstatSync(resolved).isSymbolicLink(), 'OUTPUT_IS_SYMLINK');
    need(statSync(resolved).isDirectory(), 'OUTPUT_NOT_DIRECTORY');
    need(readdirSync(resolved).length === 0, 'OUTPUT_NOT_EMPTY', 'Output already contains files; choose a new empty directory.');
  }
  return resolved;
}

function privateDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (process.platform === 'win32') {
    // Paths are data in the environment, never interpolated into shell code.
    // Windows chmod cannot restrict ACLs; inspect inherited readers instead.
    const script = `$ErrorActionPreference='Stop';
      $current=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;
      $acl=[System.IO.Directory]::GetAccessControl($env:ZFARM_EXPORT_ACL_DIR);
      if($null -eq $acl){throw 'ACL_UNAVAILABLE'};
      $owner=$acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;
      $allowed=@($current,$owner,'S-1-5-18','S-1-5-32-544','S-1-3-0','S-1-3-4');
      $rules=$acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);
      $bad=@($rules | Where-Object {
        $_.AccessControlType -eq 'Allow' -and ([int]$_.FileSystemRights -band 1) -ne 0 -and
        $allowed -notcontains $_.IdentityReference.Value
      }); [Console]::Out.Write($(if($bad.Count -eq 0){'private'}else{'not-private'}));`;
    let status;
    try { status = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { env: { ...process.env, ZFARM_EXPORT_ACL_DIR: directory }, timeout: 10000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim(); }
    catch { throw new ExportError('OUTPUT_ACL_CHECK_FAILED'); }
    need(status === 'private', 'OUTPUT_ACL_NOT_PRIVATE', 'Output ACL grants another principal read access; use a private parent directory.');
  } else {
    const info = statSync(directory);
    need((info.mode & 0o077) === 0 && (typeof process.geteuid !== 'function' || info.uid === process.geteuid()), 'OUTPUT_PERMISSIONS_NOT_PRIVATE');
  }
}

function writeNewFile(out, relative, bytes) {
  const filename = path.join(out, ...relative.split('/'));
  need(within(realpathSync(path.dirname(filename)), realpathSync(out)), 'OUTPUT_FILE_ESCAPES_PRIVATE_DIRECTORY');
  writeFileSync(filename, bytes, { flag: 'wx', mode: 0o600 });
  need(sha256(readBytes(filename)) === sha256(bytes), 'EXPORTED_BYTES_MISMATCH');
  return filename;
}

function bundleRelative(value, root) {
  need(typeof value === 'string' && value.length > 0 && !absoluteAny(value) && !value.includes('\\')
    && value.split('/').every(part => part && part !== '.' && part !== '..'), 'INVALID_BUNDLE_RELATIVE_PATH');
  const filename = path.resolve(root, ...value.split('/'));
  need(within(filename, root), 'BUNDLE_PATH_ESCAPES_MANIFEST');
  return filename;
}

function remapMetadata(value, mapping, unmapped, pointer = '') {
  if (Array.isArray(value)) return value.map((item, index) => remapMetadata(item, mapping, unmapped, `${pointer}/${index}`));
  if (!object(value)) return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    const location = `${pointer}/${key}`;
    // Envelopes themselves remain intact; only evidence-reference metadata moves.
    if (key === 'payload' && typeof value.checksum === 'string') { result[key] = item; continue; }
    if (['path', 'screenshot', 'recoveredBaselineArtifact', 'recoveredBaselineArtifactPath'].includes(key) && typeof item === 'string') {
      result[key] = mapping.get(item) || item;
      if (!mapping.has(item) && absoluteAny(item)) unmapped.push({ jsonPointer: location, path: item, copied: false });
    } else result[key] = remapMetadata(item, mapping, unmapped, location);
  }
  return result;
}

function evidencePathTags(report) {
  need(object(report) && Array.isArray(report.snapshots), 'ORIGINAL_REPORT_NOT_RUNNER_EVIDENCE');
  const mapping = new Map();
  for (const [index, metadata] of report.snapshots.entries()) {
    need(object(metadata) && typeof metadata.path === 'string', 'ORIGINAL_REPORT_NOT_RUNNER_EVIDENCE');
    mapping.set(metadata.path, `snapshot-${index}-save`);
    if (typeof metadata.screenshot === 'string') mapping.set(metadata.screenshot, `snapshot-${index}-screenshot`);
  }
  return remapMetadata(report, mapping, []);
}

export function parseArgs(argv) {
  const args = { roots: [], servedRoots: [], repositoryRoots: [] };
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index];
    if (option === '--help') return { help: true };
    need(['--report', '--allowed-root', '--served-root', '--repository-root', '--out', '--source-manifest'].includes(option)
      && typeof argv[index + 1] === 'string' && !argv[index + 1].startsWith('--'), 'INVALID_CLI_ARGUMENTS');
    const value = argv[++index];
    const arrays = { '--allowed-root': 'roots', '--served-root': 'servedRoots', '--repository-root': 'repositoryRoots' };
    if (arrays[option]) args[arrays[option]].push(value);
    else {
      const key = { '--report': 'report', '--out': 'out', '--source-manifest': 'sourceManifest' }[option];
      need(!args[key], 'DUPLICATE_CLI_ARGUMENT'); args[key] = value;
    }
  }
  need(args.report && args.out && args.roots.length > 0, 'REPORT_ALLOWED_ROOT_AND_OUT_REQUIRED');
  need(args.servedRoots.length > 0, 'SERVED_ROOT_CONFIGURATION_REQUIRED', 'Declare every production served root with --served-root.');
  return args;
}

export function exportArtifacts(args) {
  need(args.report && args.out && args.roots?.length > 0 && args.servedRoots?.length > 0, 'EXPORT_CONFIGURATION_INCOMPLETE');
  const roots = args.roots.map(rootDirectory);
  const forbidden = [...args.servedRoots, ...(args.repositoryRoots || []), ...detectedRepositoryRoots()].map(rootDirectory);
  const out = validateOutput(args.out, forbidden);
  const sourceReport = permittedFile(path.resolve(args.report), roots);
  const inputBytes = readBytes(sourceReport);
  const inputReportSha256 = sha256(inputBytes);
  const report = json(inputBytes, 'INVALID_REPORT_JSON');
  need(object(report) && Array.isArray(report.snapshots) && typeof report.ok === 'boolean', 'MISSING_RUNNER_REPORT_FIELDS');
  need(report.runner === 'server-three-days' && report.mode === 'public-action-calendar-progression'
    || report.runner === 'smoke-three-days' && report.mode === 'python-playwright-public-action-calendar-progression', 'UNRECOGNIZED_RUNNER_REPORT');
  const sessions = report.resumeSessions || [], builds = report.buildSessions || [];
  need(Number.isFinite(report.startedAtUnix) && Array.isArray(sessions) && Array.isArray(builds)
    && [...sessions, ...builds].every(item => object(item) && Number.isFinite(item.atUnix)), 'INVALID_REPORT_SESSION_MARKERS');
  const latestSession = Math.max(report.startedAtUnix, ...sessions.map(item => item.atUnix), ...builds.map(item => item.atUnix));
  need(Number.isFinite(report.finishedAtUnix) && report.finishedAtUnix >= latestSession,
    'REPORT_NOT_TERMINAL', 'A final report marker must follow the most recent run/session; confirm its process has exited.');
  need(report.policy?.saveInjection === false && report.policy.hiddenStateMutation === false
    && report.policy.internalFunctionCalls === false && report.policy.primarySaveReadOnly === true, 'UNRECOGNIZED_EVIDENCE_POLICY');

  const sourceFiles = [{ filename: sourceReport, hash: inputReportSha256 }];
  let originBytes = inputBytes;
  let incomingManifestSha256 = null;
  let incoming = null;
  const incomingMap = new Map();
  if (args.sourceManifest) {
    const manifestFile = permittedFile(path.resolve(args.sourceManifest), roots);
    const bytes = readBytes(manifestFile); incomingManifestSha256 = sha256(bytes);
    sourceFiles.push({ filename: manifestFile, hash: incomingManifestSha256 });
    incoming = json(bytes, 'INVALID_SOURCE_MANIFEST_JSON');
    need(incoming.exporter === 'export-three-days-artifacts' && incoming.version === 1
      && incoming.portableReportSha256 === inputReportSha256 && sha(incoming.originalReportSha256)
      && Array.isArray(incoming.artifacts), 'SOURCE_MANIFEST_REPORT_HASH_MISMATCH');
    need(path.dirname(sourceReport) === path.dirname(manifestFile), 'SOURCE_REPORT_MANIFEST_DIFFERENT_BUNDLE');
    need(incoming.originalReportRelativePath === 'original-report.json' && incoming.portableReportRelativePath === 'report.json'
      && path.basename(sourceReport) === 'report.json', 'SOURCE_MANIFEST_REPORT_FILENAME_MISMATCH');
    const bundle = path.dirname(manifestFile);
    const origin = permittedFile(bundleRelative(incoming.originalReportRelativePath, bundle), roots);
    originBytes = readBytes(origin);
    need(sha256(originBytes) === incoming.originalReportSha256, 'ORIGINAL_REPORT_HASH_MISMATCH');
    const original = json(originBytes, 'ORIGINAL_REPORT_NOT_JSON');
    need(isDeepStrictEqual(evidencePathTags(original), evidencePathTags(report)), 'SOURCE_REPORT_EVIDENCE_CHANGED',
      'Relocation may change evidence paths only; original results, failures and state projections must remain identical.');
    sourceFiles.push({ filename: origin, hash: incoming.originalReportSha256 });
    for (const entry of incoming.artifacts) {
      need(object(entry) && typeof entry.exportedPath === 'string' && !incomingMap.has(entry.exportedPath)
        && ['save', 'screenshot'].includes(entry.kind) && ['copied', 'missing'].includes(entry.status), 'INVALID_SOURCE_ARTIFACT_MAPPING');
      incomingMap.set(entry.exportedPath, { ...entry, filename: bundleRelative(entry.relativePath, bundle) });
    }
  }

  const mapping = new Map();
  const plans = [];
  for (const [index, metadata] of report.snapshots.entries()) {
    need(object(metadata) && typeof metadata.stage === 'string', 'INVALID_SNAPSHOT_METADATA');
    const stage = metadata.stage.replace(/[^a-zA-Z0-9_-]/g, '-');
    const prefix = `${String(index).padStart(2, '0')}-${stage}`;
    for (const kind of ['save', 'screenshot']) {
      const declared = kind === 'save' ? metadata.path : metadata.screenshot;
      if (kind === 'screenshot' && declared == null) continue;
      need(absoluteAny(declared), 'SNAPSHOT_REFERENCE_NOT_ABSOLUTE');
      const expectedName = kind === 'save' ? `${prefix}-save.json` : `${prefix}.png`;
      need(basenameAny(declared) === expectedName, 'SNAPSHOT_FILENAME_STAGE_MISMATCH');
      const inherited = incoming ? incomingMap.get(declared) : null;
      if (incoming) need(inherited && inherited.kind === kind && inherited.snapshotIndex === index, 'SOURCE_ARTIFACT_MAPPING_MISSING');
      const filename = inherited ? inherited.filename : declared;
      const real = permittedFile(filename, roots, kind === 'screenshot');
      const relativePath = `${kind === 'save' ? 'artifacts' : 'screenshots'}/${expectedName}`;
      const exportedPath = path.join(out, ...relativePath.split('/'));
      need(!mapping.has(declared), 'DUPLICATE_SNAPSHOT_ARTIFACT_REFERENCE');
      mapping.set(declared, exportedPath);
      const record = { snapshotIndex: index, kind, originalDeclaredPath: declared, sourceRealPath: real,
        relativePath, exportedPath, status: real ? 'copied' : 'missing', sha256: null, byteLength: null };
      if (!real) {
        if (inherited) need(inherited.status === 'missing', 'RELOCATED_ARTIFACT_UNAVAILABLE');
        plans.push({ record, bytes: null }); continue;
      }
      need(path.basename(real) === expectedName, 'ARTIFACT_REAL_FILENAME_STAGE_MISMATCH');
      const bytes = readBytes(real); record.sha256 = sha256(bytes); record.byteLength = bytes.length;
      if (inherited) need(inherited.status === 'copied' && inherited.sha256 === record.sha256, 'SOURCE_ARTIFACT_HASH_MISMATCH');
      if (kind === 'save') {
        const envelope = json(bytes, 'SAVE_NOT_JSON_ENVELOPE');
        need(object(envelope) && object(envelope.payload) && typeof envelope.checksum === 'string', 'SAVE_NOT_ENVELOPE');
        record.fnvStored = envelope.checksum; record.fnvComputed = fnv(envelope.payload);
        record.fnvMatches = record.fnvStored === record.fnvComputed;
      }
      sourceFiles.push({ filename: real, hash: record.sha256 });
      plans.push({ record, bytes });
    }
  }
  const unmapped = [];
  const portable = remapMetadata(report, mapping, unmapped);
  need(portable.ok === report.ok, 'RUNNER_RESULT_CHANGED');
  const portableBytes = Buffer.from(JSON.stringify(portable, null, 2) + '\n');
  for (const file of sourceFiles) need(sha256(readBytes(file.filename)) === file.hash, 'SOURCE_CHANGED_DURING_EXPORT');
  // Input checks complete before any destination is created or changed.
  validateOutput(out, forbidden);
  privateDirectory(out);
  privateDirectory(path.join(out, 'artifacts'));
  privateDirectory(path.join(out, 'screenshots'));
  for (const item of plans) if (item.bytes !== null) writeNewFile(out, item.record.relativePath, item.bytes);
  writeNewFile(out, 'original-report.json', originBytes);
  writeNewFile(out, 'report.json', portableBytes);
  const manifest = { exporter: 'export-three-days-artifacts', version: 1, reranGame: false, changedGameState: false,
    claimedGameplayPass: false, originalRunnerOk: report.ok, originalReportSha256: sha256(originBytes), inputReportSha256,
    portableReportSha256: sha256(portableBytes), originalReportRelativePath: 'original-report.json', portableReportRelativePath: 'report.json',
    incomingManifestSha256, sourceFinishedAtUnix: report.finishedAtUnix,
    terminationBasis: 'final-marker-after-latest-session; caller-confirms-process-terminal',
    forbiddenOutputRootCount: forbidden.length, artifacts: plans.map(item => item.record), unmappedMetadataReferences: unmapped,
    relocation: 'Re-export report.json with --source-manifest manifest.json into another empty private directory to bind local absolute paths.' };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  writeNewFile(out, 'manifest.json', manifestBytes);
  return { exported: true, originalRunnerOk: report.ok, claimedGameplayPass: false, originalReportSha256: manifest.originalReportSha256,
    manifestSha256: sha256(manifestBytes), copiedSaves: plans.filter(item => item.record.kind === 'save').length,
    copiedScreenshots: plans.filter(item => item.record.kind === 'screenshot' && item.bytes !== null).length,
    missingScreenshots: plans.filter(item => item.record.kind === 'screenshot' && item.bytes === null).length,
    unmappedMetadataReferenceCount: unmapped.length, output: out };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) console.log('Usage: node export-three-days-artifacts.mjs --report REPORT.json --allowed-root PRIVATE_DIR [--allowed-root DIR] --served-root PRODUCTION_DIR [--served-root DIR] --out NEW_EMPTY_PRIVATE_DIR [--repository-root REPO] [--source-manifest BUNDLE/manifest.json]\nOnly export after confirming the runner process has terminated. A failed runner report remains failed.');
    else console.log(JSON.stringify(exportArtifacts(args), null, 2));
  } catch (error) {
    console.log(JSON.stringify({ exported: false, error: error instanceof ExportError
      ? { code: error.code, message: error.message } : { code: 'FILESYSTEM_OPERATION_FAILED', message: 'Export failed; any partial private output is retained. Choose a new empty destination when retrying.' } }, null, 2));
    process.exitCode = 1;
  }
}
