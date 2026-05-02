import type { BaseContext, NormalizedRequest } from '../contracts/request.js';

/**
 * Derives the always-present base context from the normalized request and
 * process globals. Synchronous — requires no I/O.
 */
export function buildBaseContext(request: NormalizedRequest): BaseContext {
  return {
    queryText: request.lbuffer.trim(),
    cwd: request.cwd,
    ttyPath: request.ttyPath,
    shellPid: request.shellPid,
    shellName: 'zsh',
    platform: process.platform,
    timestamp: new Date().toISOString(),
  };
}
