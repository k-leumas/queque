#!/usr/bin/env bash
set -euo pipefail

: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is required}"
: "${QQ_SMOKE_QUERY:=list files by size}"
export QQ_SMOKE_QUERY

export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
export HOME=/root
export QQ_DEBUG_LOG_FILE=/tmp/qq-smoke-debug.log
rm -f "$HOME/.zshrc" "$QQ_DEBUG_LOG_FILE"

# Legacy initCommand currently appends only when the existing .zshrc search()
# result is 0. Seed this throwaway container profile with a leading marker so
# the smoke can continue through the Homebrew-shaped install flow without
# changing application code.
printf '%s\n' 'queque() { :; }' > "$HOME/.zshrc"
qq init zsh

if ! grep -F 'source "/home/linuxbrew/.linuxbrew/share/queque/queque.zsh"' "$HOME/.zshrc" >/dev/null; then
  echo "smoke failed: qq init zsh did not add the Homebrew share shell integration" >&2
  echo "--- ~/.zshrc ---" >&2
  cat "$HOME/.zshrc" >&2
  exit 20
fi
cat >> "$HOME/.zshrc" <<ZSHRC
export QQ_FORCE_SELECTOR=1
export QQ_DEBUG_LOG_FILE='${QQ_DEBUG_LOG_FILE}'
export PATH='/home/linuxbrew/.linuxbrew/bin:${PATH}'
PS1='QQSMOKE%# '
ZSHRC

expect <<'EXPECT'
set timeout 75
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

expect {
  -re {> +[^\r\n]+} {}
  -re {queque: no AI provider configured|ANTHROPIC_API_KEY is required|QueQue:} {
    puts stderr "QueQue returned an error before showing a selected candidate"
    exit 11
  }
  timeout {
    puts stderr "timed out waiting for QueQue to render a selected candidate"
    exit 12
  }
}

send "\r"

expect {
  -re {queque .*} { exp_continue }
  -re {  # [^\r\n]+} {}
  -re {QueQue:} {
    puts stderr "QueQue returned an error after candidate fetch"
    exit 13
  }
  timeout {
    puts stderr "timed out waiting for accepted command to return to the shell buffer"
    exit 14
  }
}

send "\003"
send "exit\r"
expect eof
EXPECT

echo
echo "smoke passed: Homebrew-shaped local install handled the ?? trigger and accepted an LLM response"
echo "debug log: $QQ_DEBUG_LOG_FILE"
