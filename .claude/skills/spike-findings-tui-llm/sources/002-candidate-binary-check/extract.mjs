// Spike 002 — find every program a candidate command would run.
// lexHand(): hand-written zsh-ish lexer (quotes, $( ), backticks, <( ), redirs, placeholders).
// commandWords(tokens): shared parser over a token stream (works on lexHand or shell-quote tokens).

const OP_CHARS = new Set(['|', '&', ';', '(', ')', '\n']);
const REDIR_RE = /^(\d*)(>>|>&|>\||&>>|&>|<<<|<<-|<<|<>|<&|>|<)/;
const PLACEHOLDER_RE = /^<[A-Za-z0-9@._:\/+~-]+>/;

/** Index just past the `close` that balances the `open` at s[i]. Respects quotes and escapes. */
function scanBalanced(s, i, open, close) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === "'") { j = s.indexOf("'", j + 1); if (j < 0) return s.length; continue; }
    if (c === '"') {
      for (j++; j < s.length && s[j] !== '"'; j++) if (s[j] === '\\') j++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return s.length;
}

export function lexHand(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '#') { const nl = s.indexOf('\n', i); i = nl < 0 ? s.length : nl; continue; }
    if (c === '\n') { tokens.push({ t: 'op', v: ';' }); i++; continue; }

    const two = s.slice(i, i + 2);
    if (['&&', '||', '|&', ';;'].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }

    // Process substitution: argument whose body is a command list.
    if (two === '<(' || two === '>(') {
      const end = scanBalanced(s, i + 1, '(', ')');
      tokens.push({ t: 'word', v: '<proc-subst>', subs: [s.slice(i + 2, end - 1)], dynamic: true });
      i = end; continue;
    }
    // QueQue placeholder convention wins over redirection: <user@host>, <filename>.
    const ph = s.slice(i).match(PLACEHOLDER_RE);
    if (ph) { tokens.push({ t: 'word', v: ph[0], placeholder: true, subs: [] }); i += ph[0].length; continue; }

    const rd = s.slice(i).match(REDIR_RE);
    if (rd && (rd[1] === '' || /\s|^$/.test(s[i - 1] ?? ''))) {
      tokens.push({ t: 'redir', v: rd[0] }); i += rd[0].length;
      // `>&1` / `2>&-` targets are fd numbers glued to the operator.
      if (/&$/.test(rd[2]) && /[\d-]/.test(s[i] ?? '')) { while (/[\d-]/.test(s[i] ?? '')) i++; tokens.pop(); }
      continue;
    }
    if (OP_CHARS.has(c)) { tokens.push({ t: 'op', v: c }); i++; continue; }

    // Word.
    let v = '';
    const subs = [];
    let quoted = false;
    let dynamic = false;
    let lead = null; // literal text before the first quote/escape — what assignment detection sees
    const start = i;
    while (i < s.length) {
      const ch = s[i];
      if (ch === ' ' || ch === '\t' || OP_CHARS.has(ch)) break;
      if ((ch === '<' || ch === '>') && i !== start) break;
      if ((ch === '\\' || ch === "'" || ch === '"') && lead === null) lead = v;
      if (ch === '\\') { v += s[i + 1] ?? ''; i += 2; quoted = true; continue; }
      if (ch === "'") {
        const end = s.indexOf("'", i + 1);
        v += s.slice(i + 1, end < 0 ? s.length : end); i = end < 0 ? s.length : end + 1; quoted = true; continue;
      }
      if (ch === '"') {
        quoted = true;
        for (i++; i < s.length && s[i] !== '"'; i++) {
          if (s[i] === '\\') { v += s[++i]; continue; }
          if (s[i] === '$' && s[i + 1] === '(' && s[i + 2] !== '(') {
            const end = scanBalanced(s, i + 1, '(', ')'); subs.push(s.slice(i + 2, end - 1)); v += '$(…)'; i = end - 1; continue;
          }
          if (s[i] === '`') {
            // Unterminated backtick: consume to end. indexOf -1 here once rewound i to 0 → infinite loop.
            const found = s.indexOf('`', i + 1); const end = found < 0 ? s.length : found;
            subs.push(s.slice(i + 1, end)); v += '`…`'; i = end; continue;
          }
          v += s[i];
        }
        i++; continue;
      }
      if (ch === '$') {
        if (i === start) dynamic = true;
        if (s[i + 1] === '(' && s[i + 2] === '(') { const end = scanBalanced(s, i + 1, '(', ')'); v += s.slice(i, end); i = end; continue; }
        if (s[i + 1] === '(') { const end = scanBalanced(s, i + 1, '(', ')'); subs.push(s.slice(i + 2, end - 1)); v += '$(…)'; i = end; continue; }
        if (s[i + 1] === '{') { const end = scanBalanced(s, i + 1, '{', '}'); v += s.slice(i, end); i = end; continue; }
      }
      if (ch === '`') {
        const end = s.indexOf('`', i + 1); subs.push(s.slice(i + 1, end < 0 ? s.length : end));
        if (i === start) dynamic = true; v += '`…`'; i = end < 0 ? s.length : end + 1; continue;
      }
      v += ch; i++;
    }
    tokens.push({ t: 'word', v, subs, quoted, dynamic, lead: lead ?? v });
  }
  return tokens;
}

// zsh reserved words that leave us expecting a command word next.
const RES_EXPECT = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}', 'time', 'fi', 'done', 'esac', 'coproc', 'nocorrect', 'noglob', 'repeat', 'end']);
const RES_LOOP = new Set(['for', 'foreach', 'select']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish']);

// Wrappers: external programs whose first non-option operand is another program.
// Value = options that take a separate argument.
const WRAPPERS = {
  sudo: new Set(['-u', '-g', '-h', '-p', '-C', '-D', '-r', '-t', '-U', '-T']),
  doas: new Set(['-u', '-C']),
  env: new Set(['-u', '-C', '-S', '-P']),
  nohup: new Set(),
  nice: new Set(['-n']),
  timeout: new Set(['-s', '-k']),
  gtimeout: new Set(['-s', '-k']),
  xargs: new Set(['-n', '-P', '-L', '-I', '-d', '-E', '-s', '-a', '-J', '-R', '-S']),
  watch: new Set(['-n', '-d', '--interval']),
  stdbuf: new Set(),
  caffeinate: new Set(['-t', '-w']),
  ionice: new Set(['-c', '-n', '-p']),
};
const NEEDS_POSITIONAL = { timeout: 1, gtimeout: 1 }; // DURATION before the command

const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;

/**
 * @param tokens  token stream
 * @param builtins Set of shell builtin names
 * @param lex     lexer used to recurse into substitutions / `sh -c` strings
 * @returns Array<{ word, kind: 'external'|'builtin'|'placeholder'|'dynamic'|'path' }>
 */
export function commandWords(tokens, builtins, lex = lexHand) {
  const out = [];
  const recurse = (text) => out.push(...commandWords(lex(text), builtins, lex));
  let expect = true;
  let skipNextWord = false;
  let current = null;          // external command of the current simple command
  let prev = null;             // previous word in this simple command
  let wrapper = null;          // { name, positionalLeft }
  let skipUntil = null;        // 'do' after for-loops, ']]' after [[
  let lookupOnly = false;      // `command -v x`, `type x`, `which x`

  const reset = () => { expect = true; current = null; prev = null; wrapper = null; lookupOnly = false; };

  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.t === 'op') { if (!skipUntil) reset(); continue; }
    if (tok.t === 'redir') { skipNextWord = true; continue; }
    for (const sub of tok.subs ?? []) recurse(sub);
    if (skipNextWord) { skipNextWord = false; continue; }
    const w = tok.v;

    if (skipUntil) {
      if (w === skipUntil && !tok.quoted) { if (skipUntil === 'do') expect = true; else expect = false; skipUntil = null; }
      continue;
    }

    if (!expect) {
      // Inside an argument list. A few shapes re-open a command position.
      if (current === 'find' && ['-exec', '-execdir', '-ok', '-okdir'].includes(w)) { expect = true; prev = w; continue; }
      if (SHELLS.has(current) && prev === '-c') recurse(w);
      prev = w;
      continue;
    }

    if (wrapper) {
      if (w.startsWith('-') && !tok.quoted) {
        if (WRAPPERS[wrapper.name].has(w)) skipNextWord = true;
        continue;
      }
      if (wrapper.name === 'env' && ASSIGN_RE.test(w)) continue;
      if (wrapper.positionalLeft > 0) { wrapper.positionalLeft--; continue; }
      wrapper = null;
    }

    if (ASSIGN_RE.test(tok.lead ?? w) && (current === null || WRAPPERS[current])) continue;
    if (!tok.quoted && RES_EXPECT.has(w)) continue;
    if (!tok.quoted && RES_LOOP.has(w)) { skipUntil = 'do'; continue; }
    if (!tok.quoted && w === '[[') { skipUntil = ']]'; continue; }
    if (!tok.quoted && w === 'case') { skipUntil = 'esac'; continue; }
    if (!tok.quoted && w === 'function') { skipNextWord = true; continue; }

    expect = false;
    prev = w;
    if (tok.placeholder) { out.push({ word: w, kind: 'placeholder' }); continue; }
    if (tok.dynamic || w.startsWith('$')) { out.push({ word: w, kind: 'dynamic' }); continue; }
    if (w.includes('/')) { out.push({ word: w, kind: 'path' }); continue; }

    if (builtins.has(w)) {
      out.push({ word: w, kind: 'builtin' });
      if (w === 'exec' || w === 'builtin' || w === 'noglob' || w === 'nocorrect' || w === '-') { expect = true; continue; }
      if (w === 'command') {
        const next = tokens[k + 1];
        if (next?.t === 'word' && /^-[vV]$/.test(next.v)) { lookupOnly = true; skipNextWord = true; expect = false; continue; }
        expect = true; continue;
      }
      current = w;
      continue;
    }
    if (lookupOnly) continue;

    out.push({ word: w, kind: 'external' });
    current = w;
    if (WRAPPERS[w]) { expect = true; wrapper = { name: w, positionalLeft: NEEDS_POSITIONAL[w] ?? 0 }; }
  }
  return out;
}

/** shell-quote token stream → our token shape (no substitution awareness). */
export function fromShellQuote(parsed) {
  const toks = [];
  for (const p of parsed) {
    if (typeof p === 'string') toks.push({ t: 'word', v: p, subs: [] });
    else if (p.op === 'glob') toks.push({ t: 'word', v: p.pattern, subs: [] });
    else if (p.comment !== undefined) continue;
    else if (['>', '>>', '<', '>&', '<&', '<(', '<<<', '&>', '2>'].includes(p.op)) toks.push({ t: 'redir', v: p.op });
    else toks.push({ t: 'op', v: p.op });
  }
  return toks;
}
