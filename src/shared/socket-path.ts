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
