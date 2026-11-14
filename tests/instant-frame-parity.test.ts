/**
 * Cross-shell byte parity for the instant frame (Phase 11 D-04, quick 261011-jbh LD-1).
 *
 * Every shell adapter paints the `queque › <lbuffer>` / `thinking…` skeleton with its own
 * native, fork-free code before Node starts, so there is no shared painter to call. What keeps
 * the adapters from drifting apart (and away from the Ink loading frame) is this file: the
 * TypeScript reference in src/shared/instant-frame-spec.ts is the oracle, and every adapter in
 * `ADAPTERS` must reproduce its rows, its inline paint bytes and its Zellij pane file byte for
 * byte over the whole `FIXTURES` table (control characters, C1, truncation at several column
 * values, multibyte text under LC_ALL=C, emoji).
 *
 * Drift this guards: a changed constant on one side (viewport lines, max width, loading text),
 * a control character that leaks to the terminal in one shell, byte-based truncation in a
 * C locale, and an inline reserve that no longer matches the client's own reserve.
 *
 * Each adapter × fixture runs one child shell that sources the adapter, calls the three frame
 * functions with the lbuffer and the column count as positional arguments, and writes every
 * REPLY and the pane file into a temp dir. The files are compared, never stdout: an
 * interactive bash without a terminal can print readline noise there. Fish joins `ADAPTERS`
 * in Phase 12.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CURSOR_HOME,
  ERASE_BELOW,
  INSTANT_FRAME_LOADING_TEXT,
  INSTANT_FRAME_SPEC,
  INSTANT_FRAME_VIEWPORT_LINES,
  inlineInstantFrameBytes,
  inlineScrollReserve,
  instantFrameRows,
  MODAL_MAX_COLUMNS,
  paneInstantFrameBytes,
  RESTORE_CURSOR,
} from '../src/shared/instant-frame-spec.js';
import { MODAL_VIEWPORT_LINES } from '../src/ui/modal-layout.js';
import { ciRequired, findShell } from './helpers/shells.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const DIM = '\u001B[2m';
const UNDIM = '\u001B[22m';

/** A UTF-8 locale present on macOS, glibc (2.35+ built in) and musl. */
const UTF8_LOCALE = { LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8' };
/** The glibc image default: shells count bytes here unless the adapter switches locale. */
const C_LOCALE = { LC_ALL: 'C', LC_CTYPE: 'C', LANG: 'C' };

interface Fixture {
  name: string;
  lbuffer: string;
  columns: string;
  env?: Record<string, string>;
}

const LONG_A = 'a'.repeat(200);

/** No NUL bytes: argv cannot carry them. */
const FIXTURES: Fixture[] = [
  { name: 'ascii', lbuffer: 'echo hi', columns: '78' },
  { name: 'empty', lbuffer: '', columns: '78' },
  { name: 'control-only', lbuffer: '\u001B\u0007\t\u007F', columns: '78' },
  { name: 'esc-csi-bel', lbuffer: '\u001B[31mred\u001B[0m\u0007 bell', columns: '78' },
  { name: 'tab-nl-del', lbuffer: 'a\tb\nc\u007Fd\re', columns: '78' },
  { name: 'c1', lbuffer: 'x\u0085y\u009Bz\u0080w\u009F', columns: '78' },
  { name: 'shell-meta', lbuffer: 'a & b \\ %s $HOME `x` "q" \'s\'', columns: '78' },
  { name: 'long-78', lbuffer: LONG_A, columns: '78' },
  { name: 'long-40', lbuffer: LONG_A, columns: '40' },
  { name: 'long-3', lbuffer: LONG_A, columns: '3' },
  { name: 'long-2', lbuffer: LONG_A, columns: '2' },
  { name: 'long-1', lbuffer: LONG_A, columns: '1' },
  { name: 'long-0', lbuffer: LONG_A, columns: '0' },
  { name: 'long-empty-columns', lbuffer: LONG_A, columns: '' },
  { name: 'long-non-numeric', lbuffer: LONG_A, columns: 'wide' },
  { name: 'long-negative', lbuffer: LONG_A, columns: '-5' },
  { name: 'long-81', lbuffer: LONG_A, columns: '81' },
  { name: 'long-leading-zeros', lbuffer: LONG_A, columns: '007' },
  { name: 'accented-c-locale-40', lbuffer: 'é'.repeat(200), columns: '40', env: C_LOCALE },
  { name: 'accented-c-locale-78', lbuffer: 'é'.repeat(200), columns: '78', env: C_LOCALE },
  { name: 'accented-utf8-40', lbuffer: 'é'.repeat(200), columns: '40' },
  { name: 'emoji', lbuffer: '😀 deploy 🚀', columns: '78' },
  { name: 'emoji-long', lbuffer: '🚀'.repeat(100), columns: '40' },
];

interface Adapter {
  shell: 'zsh' | 'bash';
  bin: string | null;
  argv: (script: string) => string[];
  source: string;
}

const ADAPTERS: Adapter[] = [
  {
    shell: 'zsh',
    bin: ciRequired(findShell('zsh', { min: [5, 0] }), 'zsh 5.0+'),
    argv: (script) => ['-f', '-c', script],
    source: 'shell/zsh/queque.zsh',
  },
];

const scratch = mkdtempSync(join(tmpdir(), 'qq-frame-parity-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

function shellEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('LC_')) delete env[key];
  }
  for (const key of [
    'LANG',
    'ZELLIJ',
    'ZELLIJ_PANE_ID',
    'ZELLIJ_SESSION_NAME',
    'TMUX',
    'QQ_INSTANT_FRAME',
    'QQ_DEBUG_LOG_FILE',
    'QQ_DEV_ROOT',
  ]) {
    delete env[key];
  }
  return {
    ...env,
    QQ_DAEMON_PREWARMED: '1',
    HISTFILE: '/dev/null',
    BASH_SILENCE_DEPRECATION_WARNING: '1',
    ...UTF8_LOCALE,
    ...extra,
  };
}

/** Runs `script` in the adapter's shell with the adapter sourced first; $1.. are `args`. */
function runAdapter(
  adapter: Adapter,
  script: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): { status: number; stderr: string } {
  const full = `source '${join(repoRoot, adapter.source)}' || exit 90\n${script}`;
  const result = spawnSync(
    adapter.bin ?? adapter.shell,
    [...adapter.argv(full), adapter.shell, ...args],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return { status: result.status ?? 1, stderr: result.stderr ?? '' };
}

/** Writes the three REPLYs and the pane file into the dir passed as $3. */
const FRAME_SCRIPT = `
_qq_instant_frame "$1" "$2"; printf '%s' "$REPLY" > "$3/rows"
_qq_inline_instant_frame_bytes "$1" "$2"; printf '%s' "$REPLY" > "$3/inline"
_qq_write_pane_instant_frame "$3" "$1" "$2"
exit 0
`;

const CONSTANTS_SCRIPT = `
printf '%s\\n' "$QQ_MODAL_VIEWPORT_LINES" "$QQ_MODAL_MAX_COLUMNS" "$QQ_MODAL_PADDING_COLUMNS" \\
  "$QQ_ZELLIJ_FRAME_COLUMNS" "$QQ_INSTANT_FRAME_ROWS_ABOVE_LOADING" \\
  "$QQ_INSTANT_FRAME_LOADING_TEXT" "$QQ_INSTANT_FRAME_FILE" "$QQ_PANE_PAINT_SCRIPT" > "$1/constants"
exit 0
`;

/** Hex keeps the comparison exact (no U+FFFD repair) and the failure message on one line. */
function hex(value: string | Buffer): string {
  return (typeof value === 'string' ? Buffer.from(value, 'utf8') : value).toString('hex');
}

describe('instant frame reference (src/shared/instant-frame-spec.ts)', () => {
  it('matches the zsh z1 frame: header, two blank rows, loading row', () => {
    expect(instantFrameRows('echo hi', '78')).toBe(
      [` ${DIM}queque › echo hi${UNDIM}`, '', '', ` ${DIM}thinking…${UNDIM}`].join('\r\n'),
    );
  });

  it('draws no header row for an empty lbuffer (z2)', () => {
    expect(instantFrameRows('', '78')).toBe(['', '', ` ${DIM}thinking…${UNDIM}`].join('\r\n'));
  });

  it('strips C0, DEL and C1 from the header text', () => {
    const header = instantFrameRows('\u001B[31mred\u007F\u0085\u009Bx\ty', '78').split('\r\n')[0];
    expect(header).toBe(` ${DIM}queque › [31mredxy${UNDIM}`);
  });

  it('keeps the header for a lbuffer made only of control characters', () => {
    const header = instantFrameRows('\u001B\u0007', '78').split('\r\n')[0];
    expect(header).toBe(` ${DIM}queque › ${UNDIM}`);
  });

  it('treats empty, non-numeric, 0 and >80 columns as 80', () => {
    const text = (columns: string): string[] => [
      ...(instantFrameRows(LONG_A, columns).split('\r\n')[0] ?? '')
        .slice(1 + DIM.length)
        .replace(UNDIM, ''),
    ];
    for (const columns of ['', 'wide', '0', '81', '-5']) {
      expect(text(columns), columns).toHaveLength(78);
      expect(text(columns).at(-1), columns).toBe('…');
    }
    expect(text('40')).toHaveLength(38);
    expect(text('1').join('')).toBe('…');
    expect(text('2').join('')).toBe('…');
  });

  it('counts and cuts code points, never bytes or UTF-16 units', () => {
    const header = instantFrameRows('🚀'.repeat(100), '40').split('\r\n')[0] ?? '';
    const text = [...header.slice(1 + DIM.length).replace(UNDIM, '')];
    expect(text).toHaveLength(38);
    expect(text.at(-2)).toBe('🚀');
    expect(text.at(-1)).toBe('…');
  });

  it('builds the inline paint and the pane file from the rows', () => {
    const rows = instantFrameRows('echo hi', '78');
    expect(inlineInstantFrameBytes('echo hi', '78')).toBe(
      inlineScrollReserve(INSTANT_FRAME_VIEWPORT_LINES) + ERASE_BELOW + rows + RESTORE_CURSOR,
    );
    expect(paneInstantFrameBytes('echo hi', '78')).toBe(rows + CURSOR_HOME);
  });

  it('shares its sizing constants with the Ink UI', () => {
    expect(MODAL_VIEWPORT_LINES).toBe(INSTANT_FRAME_VIEWPORT_LINES);
    expect(INSTANT_FRAME_SPEC.viewportLines).toBe(INSTANT_FRAME_VIEWPORT_LINES);
    expect(INSTANT_FRAME_SPEC.maxColumns).toBe(MODAL_MAX_COLUMNS);
    expect(INSTANT_FRAME_SPEC.loadingText).toBe(INSTANT_FRAME_LOADING_TEXT);
  });
});

describe('layering: src/shared imports nothing from client, ui, cli or daemon', () => {
  it('no shared module imports or re-exports an upper layer', () => {
    const sharedDir = join(repoRoot, 'src', 'shared');
    const files = readdirSync(sharedDir).filter((file) => file.endsWith('.ts'));
    expect(files).toContain('instant-frame-spec.ts');
    const upward = /^(?:import|export)\b[^;]*?\bfrom\s+['"]\.\.\/(?:client|ui|cli|daemon)\//m;
    const offenders = files.filter((file) =>
      upward.test(readFileSync(join(sharedDir, file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe.each(ADAPTERS)('$shell adapter matches the reference', (adapter) => {
  describe.skipIf(adapter.bin === null)(`${adapter.source}`, () => {
    it('uses the reference constants', () => {
      const dir = mkdtempSync(join(scratch, `${adapter.shell}-constants-`));
      const run = runAdapter(adapter, CONSTANTS_SCRIPT, [dir], shellEnv());
      expect(run.status).toBe(0);
      expect(readFileSync(join(dir, 'constants'), 'utf8').split('\n').slice(0, -1)).toEqual([
        String(INSTANT_FRAME_SPEC.viewportLines),
        String(INSTANT_FRAME_SPEC.maxColumns),
        String(INSTANT_FRAME_SPEC.paddingColumns),
        String(INSTANT_FRAME_SPEC.zellijFrameColumns),
        String(INSTANT_FRAME_SPEC.rowsAboveLoading),
        INSTANT_FRAME_SPEC.loadingText,
        INSTANT_FRAME_SPEC.frameFile,
        INSTANT_FRAME_SPEC.panePaintScript,
      ]);
    });

    it.each(FIXTURES)('$name', (fixture) => {
      const dir = mkdtempSync(join(scratch, `${adapter.shell}-${fixture.name}-`));
      const run = runAdapter(
        adapter,
        FRAME_SCRIPT,
        [fixture.lbuffer, fixture.columns, dir],
        shellEnv(fixture.env),
      );
      expect(run.status).toBe(0);
      const read = (file: string): string => hex(readFileSync(join(dir, file)));
      expect(read('rows')).toBe(hex(instantFrameRows(fixture.lbuffer, fixture.columns)));
      expect(read('inline')).toBe(hex(inlineInstantFrameBytes(fixture.lbuffer, fixture.columns)));
      expect(read(INSTANT_FRAME_SPEC.frameFile)).toBe(
        hex(paneInstantFrameBytes(fixture.lbuffer, fixture.columns)),
      );
    });
  });
});
