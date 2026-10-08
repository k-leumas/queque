import * as path from 'node:path';

/**
 * Returns the Unix socket path for the qq daemon for a given UID.
 *
 * Always uses /tmp to avoid the macOS TMPDIR path-length issue.
 * Node documents a 103-byte macOS limit on Unix socket paths, and
 * macOS TMPDIR paths are often too long (e.g. /var/folders/...).
 *
 * Example: socketPathForUid(501) === '/tmp/qq-501.sock'
 */
export function socketPathForUid(uid: number): string {
  return `/tmp/qq-${uid}.sock`;
}

/**
 * Returns the Unix socket path for the current process's UID.
 */
export function socketPath(): string {
  return socketPathForUid(process.getuid?.() ?? 0);
}

/**
 * Rejects socket paths that are not `/tmp/qq-*.sock` (or `/private/tmp/qq-*.sock`).
 *
 * Call this before unlink or bind so a caller-controlled string cannot
 * delete or listen on an arbitrary file.
 */
export function assertSafeSocketPath(socketPath: string): void {
  const resolved = path.resolve(socketPath);
  const base = path.basename(resolved);
  const dir = path.dirname(resolved);
  const tmpRoots = ['/tmp', '/private/tmp'];
  if (!tmpRoots.includes(dir) || !base.startsWith('qq-') || !base.endsWith('.sock')) {
    throw new Error(`unsafe socket path rejected: ${socketPath}`);
  }
}
