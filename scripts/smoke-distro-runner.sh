#!/bin/sh
# In-container half of scripts/smoke-distro.sh. POSIX sh, runs as root in a fresh
# distro image with these mounts:
#   /pkg/*.tgz                           the `pnpm pack` tarball (the product)
#   /opt/fake/fake-claude-stream.mjs     the fake model (D-01: the only fake part)
#   /opt/qq-scripts                      this repo's scripts/ (read-only)
#   /out                                 artifacts (pty-*.log, qq-debug.log)
# No model key or token is passed in or read here: the `claude` on PATH is a shim
# around the fixture, and zsh, the widget, `qq client`, the daemon, the socket and
# the Ink TUI are the real installed product.
#
# Exit codes: 30 deps, 31 package install, 32 user, 33 `qq init zsh`; otherwise the
# exit code of scripts/smoke-distro.exp (10-16).
set -u

SMOKE_USER=qq
SMOKE_HOME=/home/qq
USER_PATH=/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin

sh /opt/qq-scripts/ci/install-distro-deps.sh --no-pnpm || exit 30

attempt=1
until npm install -g /pkg/*.tgz; do
  if [ "$attempt" -ge 3 ]; then
    echo "smoke-distro-runner: npm install -g of the tarball failed" >&2
    exit 31
  fi
  sleep 5
  attempt=$((attempt + 1))
done
command -v qq >/dev/null 2>&1 || {
  echo "smoke-distro-runner: qq is not on PATH after npm install -g" >&2
  exit 31
}

cat >/usr/local/bin/claude <<'SHIM'
#!/bin/sh
exec node /opt/fake/fake-claude-stream.mjs "${FAKE_CLAUDE_SCENARIO:-success}" "$@"
SHIM
chmod 755 /usr/local/bin/claude

ZSH_BIN=$(command -v zsh) || exit 32
if [ -f /etc/alpine-release ]; then
  adduser -D -s "$ZSH_BIN" "$SMOKE_USER" || exit 32
else
  useradd -m -s "$ZSH_BIN" "$SMOKE_USER" || exit 32
fi
chown "$SMOKE_USER" /out 2>/dev/null || chmod 0777 /out || exit 32

# Runs one command line as the smoke user with a clean HOME and PATH.
as_user() {
  su -s /bin/sh "$SMOKE_USER" -c "export HOME=$SMOKE_HOME PATH=$USER_PATH; cd $SMOKE_HOME; $1"
}

# The exports go ABOVE the QueQue source line that `qq init zsh` appends: the widget
# prewarms the daemon while ~/.zshrc loads, and the daemon keeps the env it started with.
# QQ_TELEMETRY=0 keeps the telemetry consent prompt out of the PTY (research Pitfall 10).
as_user "printf '%s\n' 'export QQ_DEBUG_LOG_FILE=/out/qq-debug.log' 'export QQ_TELEMETRY=0' >.zshrc" ||
  exit 33
as_user "qq init zsh" || exit 33
grep -q 'queque\.zsh' "$SMOKE_HOME/.zshrc" || {
  echo "smoke-distro-runner: qq init zsh did not source queque.zsh from ~/.zshrc" >&2
  exit 33
}
as_user "printf '%s\n' \"PS1='QQSMOKE%# '\" >>.zshrc" || exit 33

as_user "expect /opt/qq-scripts/smoke-distro.exp default"
exit $?
