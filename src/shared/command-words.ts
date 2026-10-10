/**
 * Command-word extraction for shell command candidates (Phase 9, D-03).
 *
 * TypeScript port of the spike 002 hand lexer
 * (.claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/extract.mjs):
 *
 * - `lexHand(s)` — zsh-ish lexer: quotes, `\` escapes, `$( )`, backticks and `<( )` recorded as
 *   nested command text, `$(( ))` / `${ }` skipped, redirections, QueQue `<placeholders>`, and
 *   `#` comments emitted as `comment` tokens. `\`-newline continuations are removed and heredoc
 *   bodies (`<<EOF` / `<<-EOF` up to the delimiter line) are skipped as data, never lexed.
 * - `commandWords(tokens, builtins)` — finds every program a command would run and classifies it.
 * - `extractCommandWords(command, builtins)` — the safe entry point: input cap plus try/catch.
 *
 * Hardening over the spike (model output is untrusted and must never hang or throw):
 * - every `indexOf` cursor clamps -1 to the end of input (ported unchanged);
 * - word-keyed tables are `Map`/`Set` (`constructor` is not a wrapper);
 * - every escape read falls back to an empty string (`"rg\` lexes to `rg`, never `rgundefined`);
 * - recursion into substitutions stops past MAX_RECURSION_DEPTH;
 * - inputs over MAX_COMMAND_LENGTH are skipped.
 *
 * Zero imports and erasable-only syntax on purpose: a Node 24 `.mjs` child process imports this
 * file directly (fuzz harness). Builtins come only from the caller (zsh handoff, D-02).
 */

/** Classification of a command word. */
export type CommandWordKind = 'external' | 'builtin' | 'placeholder' | 'dynamic' | 'path';

/** A program a command would run, with its classification. */
export interface CommandWord {
  word: string;
  kind: CommandWordKind;
}

/** Token produced by `lexHand`. */
export interface ShellToken {
  t: 'word' | 'op' | 'redir' | 'comment';
  v: string;
  /** Nested command text (`$( )`, backticks, `<( )`) to recurse into. */
  subs?: string[];
  /** The word contained a quote or escape. */
  quoted?: boolean;
  /** The word starts with an expansion (`$VAR`, backticks, process substitution). */
  dynamic?: boolean;
  /** QueQue placeholder such as `<user@host>`. */
  placeholder?: boolean;
  /** Literal text before the first quote/escape — what assignment detection sees. */
  lead?: string;
}

/** Inputs longer than this are not lexed (extractCommandWords returns []). */
export const MAX_COMMAND_LENGTH = 8192;

/** Maximum nesting depth for recursion into substitution bodies and `sh -c` strings. */
export const MAX_RECURSION_DEPTH = 32;

const OP_CHARS = new Set(['|', '&', ';', '(', ')', '\n']);
const REDIR_RE = /^(\d*)(>>|>&|>\||&>>|&>|<<<|<<-|<<|<>|<&|>|<)/;
const PLACEHOLDER_RE = /^<[A-Za-z0-9@._:/+~-]+>/;

/** Index just past the `close` that balances the `open` at s[i]. Respects quotes and escapes. */
function scanBalanced(s: string, i: number, open: string, close: string): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === "'") {
      j = s.indexOf("'", j + 1);
      if (j < 0) return s.length;
      continue;
    }
    if (c === '"') {
      for (j++; j < s.length && s[j] !== '"'; j++) if (s[j] === '\\') j++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return s.length;
}

/** A heredoc whose body starts after the next newline. */
interface PendingHeredoc {
  delim: string;
  /** `<<-`: leading tabs are stripped before comparing a line with the delimiter. */
  stripTabs: boolean;
}

/**
 * Index just past the body of each pending heredoc, starting at `i` (the start of the line
 * after the heredoc operator's line). A body runs up to and including the line equal to its
 * delimiter; an unterminated body runs to the end of input. Bodies are data, never lexed.
 */
function skipHeredocBodies(s: string, i: number, pending: readonly PendingHeredoc[]): number {
  let at = i;
  for (const { delim, stripTabs } of pending) {
    while (at < s.length) {
      const found = s.indexOf('\n', at);
      const end = found < 0 ? s.length : found;
      const line = s.slice(at, end);
      at = found < 0 ? s.length : found + 1;
      if ((stripTabs ? line.replace(/^\t+/, '') : line) === delim) break;
    }
  }
  return at;
}

/** Lexes a shell command string into word, operator, redirection and comment tokens. */
export function lexHand(s: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  // Heredocs whose delimiter word has been read; their bodies start after the next newline.
  const pendingHeredocs: PendingHeredoc[] = [];
  // Set by `<<` / `<<-` until the delimiter word arrives: whether that heredoc strips tabs.
  let heredocStripTabs: boolean | null = null;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '\\' && s[i + 1] === '\n') {
      // Line continuation: removed by the shell, so it is neither text nor a separator.
      i += 2;
      continue;
    }
    if (c === '#') {
      // Comment up to (not including) the next newline. Emitted as a token so callers can see
      // it (09-04 brace-wrapping); commandWords ignores it.
      const nl = s.indexOf('\n', i);
      const end = nl < 0 ? s.length : nl;
      tokens.push({ t: 'comment', v: s.slice(i, end) });
      i = end;
      continue;
    }
    if (c === '\n') {
      tokens.push({ t: 'op', v: ';' });
      i++;
      heredocStripTabs = null;
      if (pendingHeredocs.length > 0) {
        i = skipHeredocBodies(s, i, pendingHeredocs);
        pendingHeredocs.length = 0;
      }
      continue;
    }

    const two = s.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '|&' || two === ';;') {
      tokens.push({ t: 'op', v: two });
      i += 2;
      continue;
    }

    // Process substitution: argument whose body is a command list.
    if (two === '<(' || two === '>(') {
      const end = scanBalanced(s, i + 1, '(', ')');
      tokens.push({ t: 'word', v: '<proc-subst>', subs: [s.slice(i + 2, end - 1)], dynamic: true });
      i = end;
      continue;
    }
    // QueQue placeholder convention wins over redirection: <user@host>, <filename>.
    const ph = s.slice(i).match(PLACEHOLDER_RE);
    if (ph) {
      tokens.push({ t: 'word', v: ph[0], placeholder: true, subs: [] });
      i += ph[0].length;
      continue;
    }

    const rd = s.slice(i).match(REDIR_RE);
    if (rd && (rd[1] === '' || /\s|^$/.test(s[i - 1] ?? ''))) {
      tokens.push({ t: 'redir', v: rd[0] });
      i += rd[0].length;
      if (rd[2] === '<<' || rd[2] === '<<-') heredocStripTabs = rd[2] === '<<-';
      // `>&1` / `2>&-` targets are fd numbers glued to the operator.
      if (/&$/.test(rd[2] ?? '') && /[\d-]/.test(s[i] ?? '')) {
        while (/[\d-]/.test(s[i] ?? '')) i++;
        tokens.pop();
      }
      continue;
    }
    if (OP_CHARS.has(c)) {
      tokens.push({ t: 'op', v: c });
      i++;
      continue;
    }

    // Word.
    let v = '';
    const subs: string[] = [];
    let quoted = false;
    let dynamic = false;
    let lead: string | null = null;
    const start = i;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || OP_CHARS.has(ch)) break;
      if ((ch === '<' || ch === '>') && i !== start) break;
      if (ch === '\\' && s[i + 1] === '\n') {
        // Line continuation: no text and no word break (`fd\<newline>  x` is `fd x`).
        i += 2;
        continue;
      }
      if ((ch === '\\' || ch === "'" || ch === '"') && lead === null) lead = v;
      if (ch === '\\') {
        v += s[i + 1] ?? '';
        i += 2;
        quoted = true;
        continue;
      }
      if (ch === "'") {
        const end = s.indexOf("'", i + 1);
        v += s.slice(i + 1, end < 0 ? s.length : end);
        i = end < 0 ? s.length : end + 1;
        quoted = true;
        continue;
      }
      if (ch === '"') {
        quoted = true;
        for (i++; i < s.length && s[i] !== '"'; i++) {
          if (s[i] === '\\') {
            if (s[i + 1] === '\n') {
              // Line continuation inside double quotes is removed too.
              i++;
              continue;
            }
            // `"rg\` at end of input: the escape has no next character.
            v += s[++i] ?? '';
            continue;
          }
          if (s[i] === '$' && s[i + 1] === '(' && s[i + 2] !== '(') {
            const end = scanBalanced(s, i + 1, '(', ')');
            subs.push(s.slice(i + 2, end - 1));
            v += '$(…)';
            i = end - 1;
            continue;
          }
          if (s[i] === '`') {
            // Unterminated backtick: consume to end. indexOf -1 here once rewound i to 0 → infinite loop.
            const found = s.indexOf('`', i + 1);
            const end = found < 0 ? s.length : found;
            subs.push(s.slice(i + 1, end));
            v += '`…`';
            i = end;
            continue;
          }
          v += s[i] ?? '';
        }
        i++;
        continue;
      }
      if (ch === '$') {
        if (i === start) dynamic = true;
        if (s[i + 1] === '(' && s[i + 2] === '(') {
          const end = scanBalanced(s, i + 1, '(', ')');
          v += s.slice(i, end);
          i = end;
          continue;
        }
        if (s[i + 1] === '(') {
          const end = scanBalanced(s, i + 1, '(', ')');
          subs.push(s.slice(i + 2, end - 1));
          v += '$(…)';
          i = end;
          continue;
        }
        if (s[i + 1] === '{') {
          const end = scanBalanced(s, i + 1, '{', '}');
          v += s.slice(i, end);
          i = end;
          continue;
        }
      }
      if (ch === '`') {
        const end = s.indexOf('`', i + 1);
        subs.push(s.slice(i + 1, end < 0 ? s.length : end));
        if (i === start) dynamic = true;
        v += '`…`';
        i = end < 0 ? s.length : end + 1;
        continue;
      }
      v += ch;
      i++;
    }
    tokens.push({ t: 'word', v, subs, quoted, dynamic, lead: lead ?? v });
    if (heredocStripTabs !== null) {
      // The heredoc delimiter: quotes are already removed (`'EOF'` and `"EOF"` end at `EOF`).
      pendingHeredocs.push({ delim: v, stripTabs: heredocStripTabs });
      heredocStripTabs = null;
    }
  }
  return tokens;
}

// zsh reserved words that leave us expecting a command word next.
const RES_EXPECT = new Set([
  'if',
  'then',
  'else',
  'elif',
  'do',
  'while',
  'until',
  '!',
  '{',
  '}',
  'time',
  'fi',
  'done',
  'esac',
  'coproc',
  'nocorrect',
  'noglob',
  'repeat',
  'end',
]);
const RES_LOOP = new Set(['for', 'foreach', 'select']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish']);
const FIND_EXEC = new Set(['-exec', '-execdir', '-ok', '-okdir']);

// Wrappers: external programs whose first non-option operand is another program.
// Value = options that take a SEPARATE argument, short and long (`--user root`). `--opt=value`
// and any unlisted option are flags with no separate argument. Long options whose argument is
// optional (`xargs --max-lines[=N]`, `--replace[=S]`, `--eof[=S]`, `watch -d/--differences[=P]`)
// never take the next word, so they are deliberately not listed. A Map, never a plain object:
// words such as `constructor` must not resolve to Object.prototype members.
const WRAPPERS: Map<string, ReadonlySet<string>> = new Map([
  [
    'sudo',
    new Set([
      '-u',
      '-g',
      '-h',
      '-p',
      '-C',
      '-D',
      '-r',
      '-t',
      '-U',
      '-T',
      '--user',
      '--group',
      '--host',
      '--prompt',
      '--chdir',
      '--role',
      '--type',
      '--close-from',
      '--other-user',
      '--command-timeout',
    ]),
  ],
  ['doas', new Set(['-u', '-C'])],
  ['env', new Set(['-u', '-C', '-S', '-P', '--unset', '--chdir', '--split-string'])],
  ['nohup', new Set<string>()],
  ['nice', new Set(['-n', '--adjustment'])],
  ['timeout', new Set(['-s', '-k', '--signal', '--kill-after'])],
  ['gtimeout', new Set(['-s', '-k', '--signal', '--kill-after'])],
  [
    'xargs',
    new Set([
      '-n',
      '-P',
      '-L',
      '-I',
      '-d',
      '-E',
      '-s',
      '-a',
      '-J',
      '-R',
      '-S',
      '--max-args',
      '--max-procs',
      '--max-chars',
      '--delimiter',
      '--arg-file',
      '--process-slot-var',
    ]),
  ],
  ['watch', new Set(['-n', '--interval'])],
  ['stdbuf', new Set(['-i', '-o', '-e', '--input', '--output', '--error'])],
  ['caffeinate', new Set(['-t', '-w'])],
  ['ionice', new Set(['-c', '-n', '-p', '--class', '--classdata', '--pid'])],
]);
// zsh precommand builtins that take options before the command: `exec -a NAME cmd`,
// `command -p cmd` (`command -v|-V` is a lookup and handled separately). Same value contract.
const PRECOMMAND_OPTIONS: Map<string, ReadonlySet<string>> = new Map([
  ['exec', new Set(['-a'])],
  ['command', new Set<string>()],
]);
// DURATION before the command.
const NEEDS_POSITIONAL: Map<string, number> = new Map([
  ['timeout', 1],
  ['gtimeout', 1],
]);

// Builtins whose operands are names to look up (only when the handoff lists them as builtins).
const LOOKUP_BUILTINS: ReadonlySet<string> = new Set(['type', 'which', 'whence', 'where']);

const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

/**
 * Finds every program a token stream would run.
 *
 * @param tokens   token stream from `lexHand`
 * @param builtins shell builtin names (from the zsh handoff — never hardcoded, D-02)
 * @param depth    recursion depth into substitutions / `sh -c` strings
 */
export function commandWords(
  tokens: readonly ShellToken[],
  builtins: ReadonlySet<string>,
  depth = 0,
): CommandWord[] {
  const out: CommandWord[] = [];
  const recurse = (text: string): void => {
    if (depth + 1 > MAX_RECURSION_DEPTH) return;
    out.push(...commandWords(lexHand(text), builtins, depth + 1));
  };
  let expect = true;
  let skipNextWord = false;
  let current: string | null = null; // external command of the current simple command
  let prev: string | null = null; // previous word in this simple command
  let wrapper: { name: string; positionalLeft: number } | null = null;
  let skipUntil: string | null = null; // 'do' after for-loops, ']]' after [[
  // `command -v|-V x`, `type x`, `which x`, `whence x`, `where x`: every word up to the next
  // operator is a name to look up, never a program to run. Cleared by reset().
  let lookupOnly = false;

  const reset = (): void => {
    expect = true;
    current = null;
    prev = null;
    wrapper = null;
    lookupOnly = false;
  };

  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.t === 'comment') continue;
    if (tok.t === 'op') {
      if (!skipUntil) reset();
      continue;
    }
    if (tok.t === 'redir') {
      skipNextWord = true;
      continue;
    }
    for (const sub of tok.subs ?? []) recurse(sub);
    if (skipNextWord) {
      skipNextWord = false;
      continue;
    }
    const w = tok.v;

    if (lookupOnly) {
      // Substitutions in the operands still ran above; the operands themselves are names.
      prev = w;
      continue;
    }

    if (skipUntil) {
      if (w === skipUntil && !tok.quoted) {
        expect = skipUntil === 'do';
        skipUntil = null;
      }
      continue;
    }

    if (!expect) {
      // Inside an argument list. A few shapes re-open a command position.
      if (current === 'find' && FIND_EXEC.has(w)) {
        expect = true;
        prev = w;
        continue;
      }
      if (current !== null && SHELLS.has(current) && prev === '-c') recurse(w);
      prev = w;
      continue;
    }

    if (wrapper) {
      if (w.startsWith('-') && !tok.quoted) {
        const takesValue = WRAPPERS.get(wrapper.name) ?? PRECOMMAND_OPTIONS.get(wrapper.name);
        if (takesValue?.has(w)) skipNextWord = true;
        continue;
      }
      if (wrapper.name === 'env' && ASSIGN_RE.test(w)) continue;
      if (wrapper.positionalLeft > 0) {
        wrapper.positionalLeft--;
        continue;
      }
      wrapper = null;
      if (tok.quoted && /\s/.test(w)) {
        // `watch -n 2 'kubectl get pods'`: a quoted operand with whitespace is a whole command
        // string, not a program name. Its programs are checked; the rest are arguments.
        recurse(w);
        expect = false;
        prev = w;
        continue;
      }
    }

    if (ASSIGN_RE.test(tok.lead ?? w) && (current === null || WRAPPERS.has(current))) continue;
    if (!tok.quoted && RES_EXPECT.has(w)) continue;
    if (!tok.quoted && RES_LOOP.has(w)) {
      skipUntil = 'do';
      continue;
    }
    if (!tok.quoted && w === '[[') {
      skipUntil = ']]';
      continue;
    }
    if (!tok.quoted && w === 'case') {
      skipUntil = 'esac';
      continue;
    }
    if (!tok.quoted && w === 'function') {
      skipNextWord = true;
      continue;
    }

    expect = false;
    prev = w;
    if (tok.placeholder) {
      out.push({ word: w, kind: 'placeholder' });
      continue;
    }
    if (tok.dynamic || w.startsWith('$')) {
      out.push({ word: w, kind: 'dynamic' });
      continue;
    }
    if (w.includes('/')) {
      out.push({ word: w, kind: 'path' });
      continue;
    }

    if (builtins.has(w)) {
      out.push({ word: w, kind: 'builtin' });
      if (w === 'exec' || w === 'builtin' || w === 'noglob' || w === 'nocorrect' || w === '-') {
        expect = true;
        // `exec -a NAME cmd` / `exec -cl cmd`: skip the options before the command.
        if (PRECOMMAND_OPTIONS.has(w)) wrapper = { name: w, positionalLeft: 0 };
        continue;
      }
      if (w === 'command') {
        const next = tokens[k + 1];
        if (next?.t === 'word' && /^-[vV]$/.test(next.v)) {
          lookupOnly = true;
          expect = false;
          continue;
        }
        expect = true;
        // `command -p cmd`: skip the options before the command.
        wrapper = { name: w, positionalLeft: 0 };
        continue;
      }
      if (LOOKUP_BUILTINS.has(w)) lookupOnly = true;
      current = w;
      continue;
    }

    out.push({ word: w, kind: 'external' });
    current = w;
    if (WRAPPERS.has(w)) {
      expect = true;
      wrapper = { name: w, positionalLeft: NEEDS_POSITIONAL.get(w) ?? 0 };
    }
  }
  return out;
}

/**
 * Safe entry point: returns the command words of `command`, or [] when the input is over
 * MAX_COMMAND_LENGTH or anything throws. Never throws.
 */
export function extractCommandWords(command: string, builtins: ReadonlySet<string>): CommandWord[] {
  if (command.length > MAX_COMMAND_LENGTH) return [];
  try {
    return commandWords(lexHand(command), builtins);
  } catch {
    return [];
  }
}
