#!/bin/sh
# Usage: bash-version-check.sh refuse|accept
#
# Phase 11 D-12, the bash version policy, checked inside one official Docker Hub `bash:<tag>`
# image (bash at /usr/local/bin/bash, /bin/sh is busybox, so this file is POSIX sh). CI's
# `bash-versions` job runs it as
#   docker run --rm -e QQ_DAEMON_PREWARMED=1 -v "$PWD:/w:ro" bash:TAG \
#     sh /w/scripts/ci/bash-version-check.sh refuse|accept
# with the repo mounted read-only at /w (QQ_DAEMON_PREWARMED=1 keeps the adapter from
# starting a daemon; there is no qq in the image).
#
# Always: a non-interactive `bash -c` that sources the adapter prints nothing of its own (only
#   the `ok` the check echoes after it) and exits 0.
# refuse (3.2, 4.4): an interactive source exits 0, prints exactly one stderr line containing
#   `needs bash 5.0+` and defines no `_qq_question`; `??` is the warning macro in the emacs and
#   vi-insert keymaps (D-12 as amended in the 11-11 UAT), `_qq_old_bash_hint` prints the
#   `bash 5.0 or newer is needed for the ?? trigger` line, and on 4.x `bind -X` lists the
#   private chord \C-x\C-q running it. 3.2 has no `bind -X`, and 4.x keeps one `bind -x`
#   table for all keymaps, so the chord per keymap is proven by the real-PTY rows in
#   tests/shell-pty.test.ts (macOS /bin/bash 3.2), not here.
# accept (5.0+): an interactive source defines `_qq_question`, prints no `needs bash` line, and
#   `bind -m emacs -X` lists `?` bound to it.
# The job-control notices an interactive bash without a terminal prints itself are ignored.
# Exits non-zero at the first mismatch, naming it.
set -u

EXPECT=${1:-}
ADAPTER=/w/shell/bash/queque.bash
case $EXPECT in
  refuse | accept) ;;
  *)
    echo "usage: bash-version-check.sh refuse|accept" >&2
    exit 2
    ;;
esac

# A $BASH_ENV or $ENV file would run before the adapter in every probe below.
unset BASH_ENV ENV

[ -r "$ADAPTER" ] || {
  echo "bash-version-check: FAIL: $ADAPTER is not readable (mount the repo at /w)" >&2
  exit 1
}

VERSION=$(bash --noprofile --norc -c 'printf %s "$BASH_VERSION"') || VERSION=unknown

fail() {
  echo "bash-version-check: FAIL (expect $EXPECT, bash $VERSION): $1" >&2
  exit 1
}

TMP=$(mktemp -d) || fail "cannot create a temp dir"
trap 'rm -rf "$TMP"' EXIT

# Non-interactive: silent, exit 0.
bash --noprofile --norc -c ". '$ADAPTER'; echo ok" >"$TMP/ni.out" 2>"$TMP/ni.err"
rc=$?
[ "$rc" -eq 0 ] || fail "a non-interactive source exited $rc"
[ "$(cat "$TMP/ni.out")" = ok ] || fail "a non-interactive source printed: $(cat "$TMP/ni.out")"
[ ! -s "$TMP/ni.err" ] || fail "a non-interactive source wrote to stderr: $(cat "$TMP/ni.err")"

# Interactive: the version guard decides. stdin is /dev/null, so no terminal. bash 3.2 has no
# `bind -X` (it would exit 2 with usage), so the refuse run lists it only on 4.x.
# TERM=dumb keeps readline's meta-key escape off stdout.
PROBE=". '$ADAPTER'; type -t _qq_question || echo none"
if [ "$EXPECT" = accept ]; then
  PROBE="$PROBE; echo __qq_bind__; bind -m emacs -X"
else
  PROBE="$PROBE; for m in emacs vi-insert; do echo \"__qq_macro_\${m}__\"; bind -m \$m -s; done"
  PROBE="$PROBE; echo __qq_hint__; _qq_old_bash_hint 2>&1"
  case $VERSION in
    4.*) PROBE="$PROBE; echo __qq_chord__; bind -X" ;;
  esac
fi
TERM=dumb bash --noprofile --norc -i -c "$PROBE" </dev/null >"$TMP/i.out" 2>"$TMP/i.err"
rc=$?
grep -v -E '^bash: (no job control in this shell|cannot set terminal process group)' \
  "$TMP/i.err" >"$TMP/i.err.adapter"
DEFINED=$(sed -n 1p "$TMP/i.out")

# section NAME  the probe output between the `__qq_NAME__` marker and the next marker.
section() {
  sed -n "/^__qq_$1__\$/,/^__qq_/p" "$TMP/i.out" | sed '1d;/^__qq_/d'
}
REFUSALS=$(grep -c 'needs bash 5\.0+' "$TMP/i.err.adapter")

if [ "$EXPECT" = refuse ]; then
  [ "$rc" -eq 0 ] || fail "the interactive source exited $rc"
  [ "$DEFINED" = none ] || fail "_qq_question is defined (type -t printed: $DEFINED)"
  [ "$REFUSALS" -eq 1 ] || fail "expected one 'needs bash 5.0+' line, saw $REFUSALS"
  lines=$(grep -c . "$TMP/i.err.adapter")
  [ "$lines" -eq 1 ] || fail "expected one stderr line, saw $lines: $(cat "$TMP/i.err.adapter")"
  for m in emacs vi-insert; do
    section "macro_$m" | grep -q -F '"??": "\C-v?\C-v?\C-x\C-q"' ||
      fail "?? is not the warning macro in $m: $(section "macro_$m" | grep -F '??')"
  done
  hint=$(section hint)
  [ "$(printf '%s\n' "$hint" | grep -c .)" -eq 1 ] || fail "the hint printed: $hint"
  case $hint in
    "queque: bash 5.0 or newer is needed for the ?? trigger (this is bash "*) ;;
    *) fail "unexpected hint line: $hint" ;;
  esac
  case $VERSION in
    4.*)
      section chord | grep -q -F '"\C-x\C-q": "_qq_old_bash_hint"' ||
        fail "bind -X does not run _qq_old_bash_hint on \\C-x\\C-q: $(section chord)"
      ;;
  esac
  echo "bash-version-check: PASS bash $VERSION refuses: $(cat "$TMP/i.err.adapter")"
  echo "bash-version-check: PASS bash $VERSION ?? warns: $hint"
else
  [ "$DEFINED" = function ] || fail "_qq_question is not a function (type -t printed: $DEFINED)"
  [ "$REFUSALS" -eq 0 ] || fail "the adapter refused: $(cat "$TMP/i.err.adapter")"
  sed '1,/^__qq_bind__$/d' "$TMP/i.out" | grep -q '_qq_question' ||
    fail "bind -m emacs -X does not list _qq_question: $(cat "$TMP/i.out")"
  echo "bash-version-check: PASS bash $VERSION accepts: ? is bound to _qq_question"
fi
exit 0
