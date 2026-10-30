#!/bin/sh
# In-container half of scripts/smoke-distro.sh. POSIX sh, runs as root in a fresh
# distro image with these mounts:
#   /pkg/*.tgz                           the `pnpm pack` tarball (the product)
#   /opt/fake/fake-claude-stream.mjs     the fake model (D-01: the only fake part)
#   /opt/qq-scripts                      this repo's scripts/ (read-only)
#   /out                                 artifacts
# No model key or token is passed in or read here: the `claude` on PATH is a shim
# around the fixture, and zsh, the widget, `qq client`, the daemon, the socket and
# the Ink TUI are the real installed product.
#
# Runs `qq doctor` as the smoke user (D-17: with only `claude` faked the image must
# have no hard blocker), then the expect passes `default`, `c-locale` and `consent`,
# and stops at the first failure.
# Artifacts in /out: image.txt, doctor.json, doctor.txt, pty-default.log,
# pty-c-locale.log, pty-consent.log, qq-debug.log; on any failure also df.txt (`df -h /tmp`; a full disk
# broke the widget in research) and zshrc.txt (the smoke user's ~/.zshrc). doctor.json
# and doctor.txt are written on every path that gets as far as the smoke user, failures
# included, because the auto-revert PR body quotes them (D-15).
#
# Exit codes: 30 deps, 31 package install, 32 user, 33 `qq init zsh`;
#   exit 34 when `qq doctor --json` exits non-zero (a hard blocker on this image);
#   exit 35 when doctor.json is not a version 1 report with at least 11 checks;
#   exit 36 when the consent pass's `n` is not saved (asked, disabled, no install id);
# otherwise the exit code of scripts/smoke-distro.exp (10-19).
set -u

SMOKE_USER=qq
SMOKE_HOME=/home/qq
USER_PATH=/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin

# The host user uploads /out after the container exits (GitHub's runner is uid 1001), but the
# files are written by the in-container qq user with private modes (qq-debug.log is 0600). qq is
# uid 1000 on most images, so the upload hit EACCES and failed legs lost their diagnostics. As
# root, on every exit path, make /out readable for the host.
trap 'chmod -R a+rX /out 2>/dev/null || true' EXIT

printf '%s\n' "${QQ_SMOKE_IMAGE:-unknown}" >/out/image.txt

# Saves the failure artifacts, then exits with the given code.
fail() {
  if [ ! -f /out/doctor.json ] && command -v qq >/dev/null 2>&1 && id "$SMOKE_USER" >/dev/null 2>&1; then
    collect_doctor
  fi
  df -h /tmp >/out/df.txt 2>&1
  if [ -f "$SMOKE_HOME/.zshrc" ]; then
    cp "$SMOKE_HOME/.zshrc" /out/zshrc.txt
  fi
  exit "$1"
}

sh /opt/qq-scripts/ci/install-distro-deps.sh --no-pnpm || fail 30

attempt=1
until npm install -g /pkg/*.tgz; do
  if [ "$attempt" -ge 3 ]; then
    echo "smoke-distro-runner: npm install -g of the tarball failed" >&2
    fail 31
  fi
  sleep 5
  attempt=$((attempt + 1))
done
command -v qq >/dev/null 2>&1 || {
  echo "smoke-distro-runner: qq is not on PATH after npm install -g" >&2
  fail 31
}

cat >/usr/local/bin/claude <<'SHIM'
#!/bin/sh
exec node /opt/fake/fake-claude-stream.mjs "${FAKE_CLAUDE_SCENARIO:-success}" "$@"
SHIM
chmod 755 /usr/local/bin/claude

ZSH_BIN=$(command -v zsh) || fail 32
if [ -f /etc/alpine-release ]; then
  adduser -D -s "$ZSH_BIN" "$SMOKE_USER" || fail 32
else
  useradd -m -s "$ZSH_BIN" "$SMOKE_USER" || fail 32
fi
chown "$SMOKE_USER" /out 2>/dev/null || chmod 0777 /out || fail 32

# Runs one command line as the smoke user with a clean HOME and PATH.
as_user() {
  su -s /bin/sh "$SMOKE_USER" -c "export HOME=$SMOKE_HOME PATH=$USER_PATH; cd $SMOKE_HOME; $1"
}

# Writes /out/doctor.json (exit status in DOCTOR_RC) and the human checklist
# /out/doctor.txt, whose exit status is ignored: it is only kept for the artifact.
DOCTOR_RC=
collect_doctor() {
  as_user "qq doctor --json >/out/doctor.json"
  DOCTOR_RC=$?
  as_user "qq doctor >/out/doctor.txt 2>&1"
  return 0
}

# The exports go ABOVE the QueQue source line that `qq init zsh` appends: the widget
# prewarms the daemon while ~/.zshrc loads, and the daemon keeps the env it started with.
# QQ_TELEMETRY=0 keeps the telemetry consent prompt out of the default and c-locale PTY
# passes (research Pitfall 10); the consent pass sets QQ_SMOKE_CONSENT=1 to leave it unset.
# The telemetry line is single-quoted so zsh evaluates it, not this runner.
as_user "printf '%s\n' 'export QQ_DEBUG_LOG_FILE=/out/qq-debug.log' '[ -n \"\${QQ_SMOKE_CONSENT:-}\" ] || export QQ_TELEMETRY=0' >.zshrc" ||
  fail 33
as_user "qq init zsh" || fail 33
grep -q 'queque\.zsh' "$SMOKE_HOME/.zshrc" || {
  echo "smoke-distro-runner: qq init zsh did not source queque.zsh from ~/.zshrc" >&2
  fail 33
}
as_user "printf '%s\n' \"PS1='QQSMOKE%# '\" >>.zshrc" || fail 33

collect_doctor
if [ "$DOCTOR_RC" -ne 0 ]; then
  echo "smoke-distro-runner: qq doctor --json exited $DOCTOR_RC (a hard blocker on this image):" >&2
  cat /out/doctor.txt >&2
  fail 34
fi
jq -e '.version == 1 and (.checks | length) >= 11' /out/doctor.json >/dev/null || {
  echo "smoke-distro-runner: /out/doctor.json is not a version 1 doctor report" >&2
  fail 35
}

for pass in default c-locale consent; do
  as_user "expect /opt/qq-scripts/smoke-distro.exp $pass" || fail $?
done

# The consent pass answered `n`: asked once and saved as a no, with no install id (D-06).
as_user "jq -e '.telemetry.asked == true and .telemetry.enabled == false and (.telemetry | has(\"installId\") | not)' $SMOKE_HOME/.config/qq/config.json >/dev/null" || {
  echo "smoke-distro-runner: the consent answer was not saved as a no in ~/.config/qq/config.json" >&2
  cat "$SMOKE_HOME/.config/qq/config.json" >&2 2>/dev/null
  fail 36
}
exit 0
