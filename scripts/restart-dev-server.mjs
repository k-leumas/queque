import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const command = process.argv.slice(2);
const runCommand = command.length > 0 ? command : ['pnpm', 'dev'];
const rootDir = process.cwd();
const ignoreSegments = ['node_modules', '.git', '.planning', '.wolf', 'dist'];
const scanIntervalMs = 500;

let child = null;
let restartRequested = false;
let restartTimer = null;
let interval = null;
const knownFiles = new Map();

function log(message) {
  console.log(`[watch] ${message}`);
}

function shouldIgnore(filePath) {
  return ignoreSegments.some((segment) => filePath.includes(`${resolve(rootDir, segment)}`));
}

function collectFiles(dir, files = []) {
  if (!existsSync(dir)) {
    return files;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = resolve(dir, entry.name);
    if (shouldIgnore(filePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(filePath, files);
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }

  return files;
}

function scanForChanges() {
  const currentFiles = new Set();

  for (const filePath of collectFiles(rootDir)) {
    currentFiles.add(filePath);
    const mtimeMs = statSync(filePath).mtimeMs;
    const previous = knownFiles.get(filePath);
    if (previous === undefined) {
      knownFiles.set(filePath, mtimeMs);
      continue;
    }

    if (previous !== mtimeMs) {
      knownFiles.set(filePath, mtimeMs);
      scheduleRestart(filePath);
      return;
    }
  }

  for (const filePath of knownFiles.keys()) {
    if (!currentFiles.has(filePath)) {
      knownFiles.delete(filePath);
      scheduleRestart(filePath);
      return;
    }
  }
}

function primeSnapshot() {
  for (const filePath of collectFiles(rootDir)) {
    knownFiles.set(filePath, statSync(filePath).mtimeMs);
  }
}

function start() {
  log(`starting ${runCommand.join(' ')}`);
  child = spawn(runCommand[0], runCommand.slice(1), {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    log(`dev server exited (${reason})`);

    if (restartRequested) {
      restartRequested = false;
      start();
      return;
    }

    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    process.exitCode = code ?? 0;
  });
}

function scheduleRestart(filePath) {
  const displayPath = relative(process.cwd(), filePath);
  log(`change detected in ${displayPath}; restarting dev server`);
  restartRequested = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  }, 100);
}

log('watching for file changes');
primeSnapshot();
interval = setInterval(scanForChanges, scanIntervalMs);

start();
