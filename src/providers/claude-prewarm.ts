import type { ClaudeChild } from './claude-process.js';

/** RED stub (09.1-05 Task 1): the pool is implemented in the GREEN commit. */

export interface PrewarmSpec {
  command: string;
  argv: readonly string[];
  cwd: string;
}

export type PrewarmMissReason = 'disabled' | 'empty' | 'dead' | 'cwd' | 'prompt';

export type PrewarmTake = { child: ClaudeChild } | { miss: PrewarmMissReason };

export interface PrewarmSnapshot {
  enabled: boolean;
  state: 'empty' | 'idle';
  pid?: number;
}

function notImplemented(): never {
  throw new Error('claude-prewarm: not implemented');
}

export function prewarmKey(_spec: PrewarmSpec): string {
  return notImplemented();
}

export function enablePrewarm(): void {
  notImplemented();
}

export function disablePrewarm(): void {
  notImplemented();
}

export function schedulePrewarm(_spec: PrewarmSpec): void {
  notImplemented();
}

export function takePrewarmed(_spec: PrewarmSpec): PrewarmTake {
  return notImplemented();
}

export function retirePrewarmed(_graceMs?: number): void {
  notImplemented();
}

export function prewarmSnapshot(): PrewarmSnapshot {
  return notImplemented();
}
