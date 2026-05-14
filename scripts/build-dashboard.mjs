import { spawn } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import tty from 'node:tty';

const repoRoot = process.cwd();
const repoName = path.basename(repoRoot);
const buildCommand = process.argv.length > 2 ? process.argv.slice(2) : ['pnpm', 'run', 'build'];
const debounceMs = Number.parseInt(process.env.BUILD_DASHBOARD_DEBOUNCE ?? '150', 10);
const fallbackPollMs = Number.parseInt(process.env.BUILD_DASHBOARD_INTERVAL ?? '1000', 10);
const watchmanName = `build-dashboard-${process.pid}`;

const statusColors = {
  ok: '\x1b[32m',
  building: '\x1b[33m',
  error: '\x1b[31m',
};

const spinnerFrames = ['-', '\\', '|', '/'];
const rootConfigFiles = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'vitest.config.js',
  'playwright.config.js',
  'web-ext-config.mjs',
  'release.config.mjs',
  'commitlint.config.mjs',
  'lefthook.yml',
  'biome.json',
  'amo-metadata.json',
]);

const state = {
  status: 'ok',
  version: '',
  message: 'Initializing…',
  lastUpdateAt: '',
  history: [],
  lastErrorLog: '',
  showErrorPane: true,
  buildRunning: false,
  stopRequested: false,
  spinnerIndex: 0,
  backend: 'watchman',
};

let repoMeta = null;
let debounceTimer = null;
let spinnerTimer = null;
let pendingFiles = new Set();
let watchmanServer = null;
let watchmanClient = null;
let watchmanStdoutBuffer = '';
const watchmanPendingResponses = [];
let watchmanWatchRoot = '';
let watchmanRelativePath = '';
let watchmanTempDir = '';
let pollTimer = null;
let lastFallbackStatusSnapshot = '';
let inputStream = null;
let inputFd = null;

const _stripAnsiRe = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

await main();

async function main() {
  if (!process.stdout.isTTY) {
    console.error('build-dashboard: requires an interactive TTY');
    process.exit(1);
  }

  try {
    repoMeta = await captureRepoMeta();
    state.version = repoMeta.label;
    state.message = `Watching source files in ${repoName}`;
    state.lastUpdateAt = formatClock(new Date());

    setupTerminal();
    render();

    spinnerTimer = setInterval(() => {
      if (!state.buildRunning) return;
      state.spinnerIndex = (state.spinnerIndex + 1) % spinnerFrames.length;
      render();
    }, 150);

    await startEventLoop();
    render();
  } catch (error) {
    await shutdownWatchman();
    stopFallbackLoop();
    teardownTerminal();
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  }
}

function setupTerminal() {
  inputStream = createInputStream();
  if (!inputStream || !inputStream.isTTY) {
    throw new Error('build-dashboard: could not attach to the controlling TTY for keyboard input');
  }

  process.stdout.write('\x1b[?1049h\x1b[?25l');
  inputStream.setEncoding('utf8');
  inputStream.setRawMode(true);
  inputStream.resume();
  inputStream.on('data', handleInput);
  process.stdout.on('resize', render);
  process.on('SIGINT', requestStop);
  process.on('SIGTERM', requestStop);
  process.on('uncaughtException', handleFatal);
  process.on('unhandledRejection', handleFatal);
}

function teardownTerminal() {
  if (spinnerTimer) clearInterval(spinnerTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  if (inputStream) {
    inputStream.off('data', handleInput);
    if (typeof inputStream.setRawMode === 'function') {
      inputStream.setRawMode(false);
    }
    inputStream.pause();
    if (inputStream !== process.stdin) {
      inputStream.destroy();
    }
    inputStream = null;
  }
  if (inputFd !== null) {
    try {
      fsSync.closeSync(inputFd);
    } catch {
      // The TTY stream may already own and close this fd during destroy().
    }
    inputFd = null;
  }
  process.stdout.off('resize', render);
  process.stdout.write('\x1b[?25h\x1b[?1049l');
}

async function requestStop() {
  if (state.stopRequested) return;
  state.stopRequested = true;
  await shutdownWatchman();
  stopFallbackLoop();
  teardownTerminal();
  process.exit(0);
}

function handleFatal(error) {
  void (async () => {
    await shutdownWatchman();
    stopFallbackLoop();
    teardownTerminal();
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exit(1);
  })();
}

async function startEventLoop() {
  try {
    await startWatchmanLoop();
    state.backend = 'watchman';
  } catch (error) {
    await shutdownWatchman();
    await startFallbackLoop();
    state.backend = 'git polling fallback';
    state.message = `Watchman unavailable; using git polling fallback`;
    state.lastUpdateAt = formatClock(new Date());
  }
}

function handleInput(chunk) {
  if (chunk === '\u0003') {
    void requestStop();
    return;
  }

  if (chunk === 'q' || chunk === 'Q') {
    void requestStop();
    return;
  }

  if (chunk === 'c' || chunk === 'C') {
    state.history = [];
    state.lastErrorLog = '';
    render();
    return;
  }

  if (chunk === 'e' || chunk === 'E') {
    state.showErrorPane = !state.showErrorPane;
    render();
  }
}

function createInputStream() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    return process.stdin;
  }

  try {
    inputFd = fsSync.openSync('/dev/tty', 'r');
    return new tty.ReadStream(inputFd);
  } catch {
    return process.stdin;
  }
}

async function startWatchmanLoop() {
  watchmanTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-bookmark-watchman-'));
  const sockPath = path.join(watchmanTempDir, 'watchman.sock');
  const statefile = path.join(watchmanTempDir, 'watchman.state');
  const logfile = path.join(watchmanTempDir, 'watchman.log');

  watchmanServer = spawn(
    'watchman',
    [
      '--foreground',
      '--unix-listener-path',
      sockPath,
      '--statefile',
      statefile,
      '--logfile',
      logfile,
      '--no-save-state',
      '--no-site-spawner',
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        XDG_STATE_HOME: watchmanTempDir,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );

  let serverError = '';
  watchmanServer.stderr.on('data', (chunk) => {
    serverError += chunk;
  });

  await waitForSocket(sockPath, serverError);

  watchmanClient = spawn('watchman', ['--unix-listener-path', sockPath, '--no-spawn', '-j'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      XDG_STATE_HOME: watchmanTempDir,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  watchmanClient.stdout.setEncoding('utf8');
  watchmanClient.stdout.on('data', onWatchmanStdout);
  watchmanClient.stderr.on('data', (chunk) => {
    state.status = 'error';
    state.message = `watchman client error: ${String(chunk).trim()}`;
    render();
  });

  watchmanClient.stdin.on('error', (err) => {
    const pending = watchmanPendingResponses.splice(0);
    for (const p of pending) p.reject(err);
  });

  const watchResponse = await sendWatchmanCommand(['watch-project', repoRoot]);
  watchmanWatchRoot = watchResponse.watch;
  watchmanRelativePath = watchResponse.relative_path ?? '';

  const clockResponse = await sendWatchmanCommand(['clock', watchmanWatchRoot]);
  await sendWatchmanCommand([
    'subscribe',
    watchmanWatchRoot,
    watchmanName,
    {
      since: clockResponse.clock,
      expression: [
        'allof',
        ['type', 'f'],
        ['not', ['dirname', '.git']],
        ['not', ['dirname', 'node_modules']],
        ['not', ['dirname', 'dist']],
        ['not', ['dirname', 'web-ext-artifacts']],
        ['not', ['dirname', 'tests']],
        ['not', ['dirname', 'test-results']],
        ['not', ['dirname', 'screenshots']],
        ['not', ['dirname', 'project-files/docs']],
        ['not', ['dirname', '.planning']],
        ['not', ['dirname', '.gsd']],
        ['not', ['dirname', '.wolf']],
        ['not', ['dirname', '.claude']],
        ['not', ['dirname', '.playwright-profile-firefox']],
      ],
      fields: ['name', 'exists'],
      empty_on_fresh_instance: true,
    },
  ]);
}

function onWatchmanStdout(chunk) {
  watchmanStdoutBuffer += chunk;
  const lines = watchmanStdoutBuffer.split('\n');
  watchmanStdoutBuffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;

    let payload;
    try {
      payload = line; //since we are asking for formatted output we dont need to parse JSON.parse(line);
    } catch (error) {
      state.status = 'error';
      state.message = `watchman parse error: ${line}`;
      render();
      continue;
    }

    if (payload.subscription === watchmanName) {
      handleSubscription(payload);
      continue;
    }

    const pending = watchmanPendingResponses.shift();
    if (!pending) continue;

    if (payload.error) {
      pending.reject(new Error(payload.error));
    } else {
      pending.resolve(payload);
    }
  }
}

function handleSubscription(payload) {
  if (state.stopRequested) return;

  const files = (payload.files ?? [])
    .map((entry) => normalizeWatchmanPath(entry.name))
    .filter(Boolean)
    .filter(shouldWatchFile);

  if (files.length === 0) return;

  for (const file of files) {
    pendingFiles.add(file);
  }

  scheduleBuild();
}

function scheduleBuild() {
  if (state.buildRunning || state.stopRequested) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushPendingBuild();
  }, debounceMs);
}

async function flushPendingBuild() {
  if (state.buildRunning || state.stopRequested || pendingFiles.size === 0) return;

  const triggerFiles = [...pendingFiles].sort();
  pendingFiles = new Set();

  const triggerMeta = await captureRepoMeta();
  const summary = describeTrigger(triggerFiles, repoMeta, triggerMeta);

  state.buildRunning = true;
  state.status = 'building';
  state.message = `${formatClock(new Date())} ${summary}`;
  state.lastUpdateAt = formatClock(new Date());
  render();

  const startedAt = Date.now();
  const { code, output } = await runCommand(buildCommand, repoRoot);
  const durationMs = Date.now() - startedAt;

  if (state.stopRequested) return;

  repoMeta = await captureRepoMeta();
  state.version = repoMeta.label;
  state.lastUpdateAt = formatClock(new Date());
  state.buildRunning = false;

  state.history.push({
    time: state.lastUpdateAt,
    status: code === 0 ? 'ok' : 'error',
    durationMs,
    summary,
  });
  trimHistory();

  if (code === 0) {
    state.status = 'ok';
    state.message = `${state.lastUpdateAt} ${summary}`;
  } else {
    state.status = 'error';
    state.message = `${state.lastUpdateAt} exit ${code} ${summary}`;
    state.lastErrorLog = tailLines(output, 16);
  }

  render();

  if (pendingFiles.size > 0) {
    scheduleBuild();
  }
}

function normalizeWatchmanPath(name) {
  const normalized = name.replaceAll('\\', '/');
  if (!watchmanRelativePath) return normalized;

  const prefix = `${watchmanRelativePath}/`;
  if (normalized === watchmanRelativePath) return '';
  if (!normalized.startsWith(prefix)) return '';
  return normalized.slice(prefix.length);
}

function shouldWatchFile(relPath) {
  const normalized = relPath.replaceAll('\\', '/');
  if (!normalized) return false;

  const parts = normalized.split('/');
  const basename = parts.at(-1) ?? normalized;

  if (basename.endsWith('.md')) return false;
  if (basename.includes('.test.')) return false;
  if (parts.includes('docs')) return false;
  if (parts.includes('tests')) return false;

  if (normalized.startsWith('project-files/docs/')) return false;
  if (normalized.startsWith('scripts/')) return true;
  if (normalized.startsWith('project-files/src/')) return true;
  if (normalized.startsWith('project-files/icons/')) return true;
  if (normalized === 'project-files/domains.json') return true;
  if (normalized.startsWith('apps/site/src/')) return true;
  if (normalized.startsWith('apps/site/public/')) return true;
  if (normalized.startsWith('apps/site/') && basename === 'package.json') return true;

  return rootConfigFiles.has(normalized);
}

function describeTrigger(files, previousMeta, currentMeta) {
  const parts = [];

  if (previousMeta.head !== currentMeta.head) {
    parts.push(`HEAD ${previousMeta.label} -> ${currentMeta.label}`);
  }

  const sample = files.slice(0, 3).join(', ');
  const suffix = files.length > 3 ? ' ...' : '';
  parts.push(`${files.length} file(s): ${sample}${suffix}`);

  return parts.join(' ; ');
}

function parseStatusPaths(snapshot) {
  return snapshot
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim());
}

function diffStatusSnapshots(previousSnapshot, currentSnapshot) {
  const previous = new Set(parseStatusPaths(previousSnapshot));
  const current = new Set(parseStatusPaths(currentSnapshot));
  const changed = [];

  for (const file of current) {
    if (!previous.has(file)) changed.push(file);
  }

  for (const file of previous) {
    if (!current.has(file)) changed.push(file);
  }

  return changed.length > 0 ? changed : parseStatusPaths(currentSnapshot);
}

async function captureRepoMeta() {
  const [head, label] = await Promise.all([
    runGit(['rev-parse', 'HEAD']),
    runGit(['describe', '--tags', '--always', '--dirty']),
  ]);
  return { head, label };
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trimEnd());
      } else {
        reject(new Error(stderr.trim() || `git ${args.join(' ')} failed with exit ${code}`));
      }
    });
  });
}

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk;
    });

    child.stderr.on('data', (chunk) => {
      output += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

function sendWatchmanCommand(command) {
  return new Promise((resolve, reject) => {
    if (!watchmanClient || watchmanClient.stdin.destroyed || !watchmanClient.stdin.writable) {
      reject(new Error('watchman client is not available'));
      return;
    }
    watchmanPendingResponses.push({ resolve, reject });
    watchmanClient.stdin.write(`${JSON.stringify(command)}\n`);
  });
}

async function waitForSocket(sockPath, serverError) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      await fs.access(sockPath);
      return;
    } catch {
      if (watchmanServer.exitCode !== null) {
        throw new Error(serverError || 'watchman server exited before socket became available');
      }
      await sleep(50);
    }
  }
  throw new Error(serverError || 'timed out waiting for watchman socket');
}

async function shutdownWatchman() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  if (watchmanClient) {
    watchmanClient.stdin.end();
    watchmanClient.kill('SIGTERM');
    watchmanClient = null;
  }

  if (watchmanServer) {
    watchmanServer.kill('SIGTERM');
    watchmanServer = null;
  }

  if (watchmanTempDir) {
    await fs.rm(watchmanTempDir, { recursive: true, force: true });
    watchmanTempDir = '';
  }
}

async function startFallbackLoop() {
  lastFallbackStatusSnapshot = await runGit([
    'status',
    '--short',
    '--untracked-files=all',
    '--ignored=no',
  ]);
  pollTimer = setInterval(() => {
    void pollFallbackLoop();
  }, fallbackPollMs);
}

function stopFallbackLoop() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function pollFallbackLoop() {
  if (state.stopRequested || state.buildRunning) return;

  const currentSnapshot = await runGit([
    'status',
    '--short',
    '--untracked-files=all',
    '--ignored=no',
  ]);
  if (currentSnapshot === lastFallbackStatusSnapshot) return;

  const changed = diffStatusSnapshots(lastFallbackStatusSnapshot, currentSnapshot).filter(
    shouldWatchFile,
  );

  lastFallbackStatusSnapshot = currentSnapshot;
  if (changed.length === 0) return;

  for (const file of changed) {
    pendingFiles.add(file);
  }

  scheduleBuild();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function render() {
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;
  const errorPaneLines = state.showErrorPane && state.lastErrorLog ? 8 : 0;
  const historyRows = Math.max(5, height - 11 - errorPaneLines);
  const history = state.history.slice(-historyRows);

  const statusLabel =
    state.status === 'building'
      ? `${spinnerFrames[state.spinnerIndex]} BUILDING`
      : state.status.toUpperCase();
  const statusColor = statusColors[state.status];

  const lines = [];
  lines.push(`${bold(repoName)}  build dashboard  ${dim(state.backend)}`);
  lines.push(`${dim('command')} ${buildCommand.join(' ')}`);
  lines.push(`${dim('version')} ${state.version || 'unknown'}`);
  lines.push(`${statusColor}[${statusLabel}]\x1b[0m ${truncate(state.message, width - 12)}`);
  lines.push('');
  lines.push(tableHeader(width));

  for (const entry of history) {
    lines.push(formatEntry(entry, width));
  }

  while (lines.length < 6 + historyRows) {
    lines.push('');
  }

  if (errorPaneLines) {
    lines.push('');
    lines.push(`${bold('Last Error')}${dim('  (toggle with e)')}`);
    for (const line of state.lastErrorLog.split('\n').slice(-errorPaneLines)) {
      lines.push(truncate(line, width));
    }
  }

  lines.push('');
  lines.push(
    dim(
      'watching source files only; tests/docs ignored | q quit  c clear history  e toggle error pane',
    ),
  );

  process.stdout.write('\x1b[H\x1b[2J');
  process.stdout.write(lines.slice(0, height).join('\n'));
}

function tableHeader(width) {
  const header = [
    padRight('TIME', 8),
    padRight('STATUS', 10),
    padRight('DURATION', 10),
    'CHANGE',
  ].join('  ');
  return bold(truncate(header, width));
}

function formatEntry(entry, width) {
  const status =
    entry.status === 'ok' ? `${statusColors.ok}OK\x1b[0m` : `${statusColors.error}ERROR\x1b[0m`;
  const duration = `${(entry.durationMs / 1000).toFixed(1)}s`;
  const summary = truncate(entry.summary, Math.max(20, width - 34));

  return [
    padRight(entry.time, 8),
    padRight(status, 10 + ansiVisibleDelta(status)),
    padRight(duration, 10),
    summary,
  ].join('  ');
}

function trimHistory() {
  const maxEntries = 200;
  if (state.history.length > maxEntries) {
    state.history.splice(0, state.history.length - maxEntries);
  }
}

function tailLines(text, count) {
  return text.split('\n').slice(-count).join('\n').trimEnd();
}

function formatClock(date) {
  return date.toTimeString().slice(0, 8);
}

function truncate(text, width) {
  if (width <= 0) return '';
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  return `${text.slice(0, width - 1)}…`;
}

function padRight(text, width) {
  const visibleWidth = stripAnsi(text).length;
  const padding = Math.max(0, width - visibleWidth);
  return `${text}${' '.repeat(padding)}`;
}

function bold(text) {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text) {
  return `\x1b[2m${text}\x1b[0m`;
}

function stripAnsi(text) {
  return text.replace(_stripAnsiRe, '');
}

function ansiVisibleDelta(text) {
  return text.length - stripAnsi(text).length;
}
