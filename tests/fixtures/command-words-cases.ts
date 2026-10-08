/**
 * Spike 002 accuracy cases for the command-word extractor, copied verbatim from
 * .claude/skills/spike-findings-tui-llm/sources/002-candidate-binary-check/cases.mjs
 * (same strings, same order, same tiers).
 *
 * `tier: 'stretch'` is a label carried over from the spike, NOT an opt-out: every case,
 * core and stretch alike, must pass against src/shared/command-words.ts (the spike scored 40/40).
 *
 * Expected = every program the shell would look up, in order. Wrappers (sudo, xargs…) count too.
 * Builtins/reserved words/placeholders/$vars/paths are NOT listed here — they are classified
 * separately and never checked against $commands.
 */

/** One spike 002 case: a command and the `external` words it must yield, in order. */
export interface CommandWordCase {
  cmd: string;
  expect: readonly string[];
  tier: 'core' | 'stretch';
}

export const COMMAND_WORD_CASES: readonly CommandWordCase[] = [
  { cmd: 'ls -la', expect: ['ls'], tier: 'core' },
  { cmd: 'rg TODO src | head -n 20', expect: ['rg', 'head'], tier: 'core' },
  { cmd: 'git status && git diff --stat', expect: ['git', 'git'], tier: 'core' },
  { cmd: 'sudo FOO=1 rg x | fzf && jq .', expect: ['sudo', 'rg', 'fzf', 'jq'], tier: 'core' },
  { cmd: 'FOO=bar BAZ="a b" node script.js', expect: ['node'], tier: 'core' },
  { cmd: 'env NODE_ENV=production pnpm build', expect: ['env', 'pnpm'], tier: 'core' },
  { cmd: 'sudo -u postgres psql -c "select 1"', expect: ['sudo', 'psql'], tier: 'core' },
  {
    cmd: 'find . -name "*.log" -mtime +7 | xargs rm -f',
    expect: ['find', 'xargs', 'rm'],
    tier: 'core',
  },
  { cmd: 'xargs -n 1 -P 4 curl -sO < urls.txt', expect: ['xargs', 'curl'], tier: 'core' },
  { cmd: 'kill -9 $(lsof -ti :3000)', expect: ['lsof'], tier: 'core' }, // kill is a builtin in zsh
  { cmd: 'echo "today is $(date +%A)"', expect: ['date'], tier: 'core' },
  { cmd: 'du -sh * | sort -rh | head -10', expect: ['du', 'sort', 'head'], tier: 'core' },
  { cmd: 'cd ~/proj; make -j8 2>&1 | tee build.log', expect: ['make', 'tee'], tier: 'core' },
  { cmd: 'docker ps -q | xargs docker stop', expect: ['docker', 'xargs', 'docker'], tier: 'core' },
  { cmd: 'time npm test', expect: ['npm'], tier: 'core' }, // time is a reserved word in zsh
  { cmd: 'nohup python3 server.py > out.log 2>&1 &', expect: ['nohup', 'python3'], tier: 'core' },
  { cmd: 'timeout 5s curl https://example.com', expect: ['timeout', 'curl'], tier: 'core' },
  { cmd: 'nice -n 10 tar -czf backup.tgz dir/', expect: ['nice', 'tar'], tier: 'core' },
  { cmd: 'watch -n 2 kubectl get pods', expect: ['watch', 'kubectl'], tier: 'core' },
  { cmd: 'diff <(sort a.txt) <(sort b.txt)', expect: ['diff', 'sort', 'sort'], tier: 'core' },
  {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: zsh parameter expansion, verbatim spike case
    cmd: 'for f in *.png; do convert "$f" "${f%.png}.jpg"; done',
    expect: ['convert'],
    tier: 'core',
  },
  { cmd: 'if [ -f .env ]; then cat .env; fi', expect: ['cat'], tier: 'core' },
  { cmd: 'ssh <user@host> "tail -f /var/log/syslog"', expect: ['ssh'], tier: 'core' },
  { cmd: '<editor> ~/.zshrc', expect: [], tier: 'core' },
  { cmd: '$EDITOR ~/.zshrc', expect: [], tier: 'core' },
  { cmd: './scripts/deploy.sh --prod', expect: [], tier: 'core' },
  { cmd: "echo '$(not a subshell)' | pbcopy", expect: ['pbcopy'], tier: 'core' },
  { cmd: 'grep -r "a|b && c" . | wc -l', expect: ['grep', 'wc'], tier: 'core' },
  { cmd: 'brew install fd && fd -e ts', expect: ['brew', 'fd'], tier: 'core' },
  { cmd: 'command -v jq || brew install jq', expect: ['brew'], tier: 'core' }, // `command -v` only looks up
  { cmd: 'exec zsh', expect: ['zsh'], tier: 'core' },
  { cmd: '(cd /tmp && ls)', expect: ['ls'], tier: 'core' },
  { cmd: '{ date; uptime; } > status.txt', expect: ['date', 'uptime'], tier: 'core' },
  { cmd: 'cat <<< "hello" | base64', expect: ['cat', 'base64'], tier: 'core' },
  { cmd: 'npx -y prettier --write .', expect: ['npx'], tier: 'core' },
  { cmd: 'bash -c "ls | wc -l"', expect: ['bash', 'ls', 'wc'], tier: 'stretch' },
  { cmd: 'find . -name "*.tmp" -exec rm {} \\;', expect: ['find', 'rm'], tier: 'stretch' },
  { cmd: 'echo `whoami`', expect: ['whoami'], tier: 'stretch' },
  { cmd: '! grep -q foo file && echo missing', expect: ['grep'], tier: 'core' },
  { cmd: 'sudo -E env PATH=$PATH ncdu /', expect: ['sudo', 'env', 'ncdu'], tier: 'core' },
];
