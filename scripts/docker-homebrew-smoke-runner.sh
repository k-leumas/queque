#!/usr/bin/env bash
set -euo pipefail

: "${QQ_SMOKE_QUERY:=list files by size}"
export QQ_SMOKE_QUERY

export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
export HOME=/root
export QQ_DEBUG_LOG_FILE=/tmp/qq-smoke-debug.log
rm -f "$HOME/.zshrc" "$QQ_DEBUG_LOG_FILE"

# Only the model is fake: the `claude` on PATH is a shim around the fixture the host mounts
# read-only, so no model key or token is passed in or read here. With no key, QueQue's default
# provider runs `claude -p`; the formula-shaped install, zsh, the widget, `qq client`, the
# daemon and the Ink TUI are the real product. The shim is written before `qq init zsh` because
# the widget prewarms the daemon while ~/.zshrc loads and the daemon keeps the PATH it started
# with.
if [ ! -f /opt/fake/fake-claude-stream.mjs ]; then
  echo "smoke failed: fake claude fixture not mounted at /opt/fake/fake-claude-stream.mjs" >&2
  exit 21
fi
cat >/usr/local/bin/claude <<'SHIM'
#!/bin/sh
exec node /opt/fake/fake-claude-stream.mjs "${FAKE_CLAUDE_SCENARIO:-success}" "$@"
SHIM
chmod 755 /usr/local/bin/claude

qq init zsh

if ! grep -F 'source "/home/linuxbrew/.linuxbrew/share/queque/queque.zsh"' "$HOME/.zshrc" >/dev/null; then
  echo "smoke failed: qq init zsh did not add the Homebrew share shell integration" >&2
  echo "--- ~/.zshrc ---" >&2
  cat "$HOME/.zshrc" >&2
  exit 20
fi
# QQ_TELEMETRY=0 keeps the one-time telemetry consent question out of this run: it prints
# "QueQue: send anonymous usage..." after the first accepted ??, which the expect script below
# reads as an error (exit 13). Same opt-out as scripts/smoke-distro-runner.sh.
# QQ_NO_UPDATE_CHECK=1 keeps the daemon from asking registry.npmjs.org for a newer qq.
cat >> "$HOME/.zshrc" <<ZSHRC
export QQ_TELEMETRY=0
export QQ_NO_UPDATE_CHECK=1
export QQ_FORCE_SELECTOR=1
export QQ_DEBUG_LOG_FILE='${QQ_DEBUG_LOG_FILE}'
export PATH='/home/linuxbrew/.linuxbrew/bin:${PATH}'
PS1='QQSMOKE%# '
ZSHRC

expect <<'EXPECT'
set timeout 40
set query $env(QQ_SMOKE_QUERY)
log_user 1

spawn env TERM=xterm-256color zsh -i

expect {
  -re {QQSMOKE[#%]} {}
  timeout {
    puts stderr "timed out waiting for initial zsh prompt"
    exit 10
  }
}

send -- "$query??"

# The fake's first candidate. Never loosen this to a pattern that matches without `tldr z3`.
expect {
  "tldr z3" {}
  -re {(queque|QueQue): [^\r\n]*} {
    puts stderr "QueQue printed an error before the candidate tldr z3: $expect_out(0,string)"
    exit 11
  }
  timeout {
    puts stderr "timed out waiting for the candidate row tldr z3"
    exit 12
  }
}

send "\r"

# The prompt redraw holding the accepted command proves it reached the live zsh buffer.
expect {
  -re {QQSMOKE[%#] tldr z3  # } {}
  -re {(queque|QueQue): [^\r\n]*} {
    puts stderr "QueQue printed an error after the candidate fetch: $expect_out(0,string)"
    exit 13
  }
  timeout {
    puts stderr "timed out waiting for tldr z3 to return to the zsh buffer"
    exit 14
  }
}

send "\003"
send "exit\r"
expect eof
EXPECT

echo
echo "smoke passed: the Homebrew-shaped install handled ?? and returned the fake claude's candidate to the zsh buffer"
echo "debug log: $QQ_DEBUG_LOG_FILE"
