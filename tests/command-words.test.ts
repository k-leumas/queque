/**
 * Command-word extractor: spike 002 accuracy table, kind classification, robustness inputs and
 * the lexHand token contract 09-04 builds install forms from (SC-4, D-02, D-03, D-06).
 *
 * Builtins come from a real `zsh -f` `${(k)builtins}` listing — the same source the widget hands
 * off (D-02) — never a hardcoded list.
 */
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type CommandWord,
  extractCommandWords,
  lexHand,
  MAX_COMMAND_LENGTH,
} from '../src/shared/command-words.js';
import { COMMAND_WORD_CASES } from './fixtures/command-words-cases.js';

let builtins: ReadonlySet<string> = new Set();

beforeAll(() => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh parameter expansion, not a JS template
  const r = spawnSync('zsh', ['-f', '-c', 'zmodload zsh/parameter; print -rl -- ${(k)builtins}'], {
    encoding: 'utf8',
  });
  expect(r.error).toBeUndefined();
  expect(r.status).toBe(0);
  builtins = new Set(
    r.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
  expect(builtins.has('cd')).toBe(true);
  expect(builtins.has('kill')).toBe(true);
});

/** The `external` words of a command, in order. */
function externals(cmd: string): string[] {
  return extractCommandWords(cmd, builtins)
    .filter((w) => w.kind === 'external')
    .map((w) => w.word);
}

/** The words of a command with the given kind. */
function wordsOfKind(cmd: string, kind: CommandWord['kind']): string[] {
  return extractCommandWords(cmd, builtins)
    .filter((w) => w.kind === kind)
    .map((w) => w.word);
}

describe('spike 002 accuracy table (SC-4)', () => {
  it('has all 40 cases, 3 of them labelled stretch (every case must pass)', () => {
    expect(COMMAND_WORD_CASES).toHaveLength(40);
    expect(COMMAND_WORD_CASES.filter((c) => c.tier === 'stretch')).toHaveLength(3);
  });

  it.each(COMMAND_WORD_CASES)('[$tier] $cmd', ({ cmd, expect: want }) => {
    expect(externals(cmd)).toEqual(want);
  });
});

describe('kind classification', () => {
  it('classifies a QueQue <placeholder> as placeholder', () => {
    expect(extractCommandWords('<editor> ~/.zshrc', builtins)).toEqual([
      { word: '<editor>', kind: 'placeholder' },
    ]);
  });

  it('classifies a $VAR command as dynamic', () => {
    expect(extractCommandWords('$EDITOR ~/.zshrc', builtins)).toEqual([
      { word: '$EDITOR', kind: 'dynamic' },
    ]);
  });

  it('classifies a path command as path', () => {
    expect(extractCommandWords('./scripts/deploy.sh --prod', builtins)).toEqual([
      { word: './scripts/deploy.sh', kind: 'path' },
    ]);
  });

  it('classifies kill as a zsh builtin and lsof inside $( ) as external', () => {
    const words = extractCommandWords('kill -9 $(lsof -ti :3000)', builtins);
    expect(words).toContainEqual({ word: 'kill', kind: 'builtin' });
    expect(words).toContainEqual({ word: 'lsof', kind: 'external' });
  });

  it('never classifies reserved words as external', () => {
    expect(externals('time npm test')).toEqual(['npm']);
    const reserved = ['time', 'if', 'then', 'fi', '['];
    for (const cmd of ['time npm test', 'if [ -f .env ]; then cat .env; fi']) {
      for (const w of externals(cmd)) expect(reserved).not.toContain(w);
    }
    expect(externals('if [ -f .env ]; then cat .env; fi')).toEqual(['cat']);
  });

  it('treats `command -v` as a lookup only', () => {
    expect(externals('command -v jq || brew install jq')).toEqual(['brew']);
    expect(wordsOfKind('command -v jq || brew install jq', 'builtin')).toEqual(['command']);
  });
});

describe('D-06: install commands are ordinary commands', () => {
  it('yields brew and fd as externals with no special-case label', () => {
    const words = extractCommandWords('brew install fd && fd -e ts', builtins);
    expect(words).toEqual([
      { word: 'brew', kind: 'external' },
      { word: 'fd', kind: 'external' },
    ]);
  });
});

describe('robustness (D-03)', () => {
  it('returns [] for input over MAX_COMMAND_LENGTH', () => {
    expect(MAX_COMMAND_LENGTH).toBe(8192);
    expect(extractCommandWords('x'.repeat(8193), builtins)).toEqual([]);
  });

  it.each([
    'constructor',
    'toString',
    '__proto__',
    'hasOwnProperty',
  ])('classifies prototype key %s as external without throwing', (word) => {
    expect(extractCommandWords(word, builtins)).toEqual([{ word, kind: 'external' }]);
    expect(extractCommandWords(`${word} --x | ${word}`, builtins)).toEqual([
      { word, kind: 'external' },
      { word, kind: 'external' },
    ]);
  });

  it.each([
    ['"rg\\', ['rg']],
    ['a "b\\', ['a']],
  ])('trailing backslash in double quotes: %s', (cmd, want) => {
    expect(externals(cmd)).toEqual(want);
  });

  it('never returns a word containing the text undefined', () => {
    const inputs = [
      '"rg\\',
      'a "b\\',
      '\\',
      'rg\\',
      'echo "unterminated',
      "rg 'open",
      'echo $(date',
      'echo `whoami',
      'a"b`c',
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
      'x'.repeat(8193),
    ];
    for (const cmd of inputs) {
      for (const { word } of extractCommandWords(cmd, builtins)) {
        expect(word).not.toContain('undefined');
      }
      for (const tok of lexHand(cmd)) expect(tok.v).not.toContain('undefined');
    }
  });
});

describe('lexHand token contract (frozen for 09-04)', () => {
  it('nohup fd x 2>&1 & has exactly one op, the background &', () => {
    const ops = lexHand('nohup fd x 2>&1 &').filter((t) => t.t === 'op');
    expect(ops).toHaveLength(1);
    expect(ops[0]?.v).toBe('&');
  });

  it('a heredoc yields a << redir token', () => {
    const tokens = lexHand('cat <<EOF\nhi\nEOF');
    expect(tokens).toContainEqual({ t: 'redir', v: '<<' });
  });

  it('a trailing # comment is one comment token and is ignored by command words', () => {
    const tokens = lexHand('cd src; fd x # note');
    expect(tokens.filter((t) => t.t === 'comment')).toHaveLength(1);
    expect(externals('cd src; fd x # note')).toEqual(['fd']);
  });

  it('a bare comment is a single comment token with no word', () => {
    expect(lexHand('# c')).toEqual([{ t: 'comment', v: '# c' }]);
  });
});
