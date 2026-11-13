#!/usr/bin/env bash
# Runs every case against each bash given as an argument; prints log + what bash executed.
here=$(cd "$(dirname "$0")" && pwd)
for b in "$@"; do
  echo "=== $b ($("$b" -c 'echo $BASH_VERSION'))"
  for c in emacs single midline cafe emoji mb_mid vi vi_cafe paste_on paste_off; do
    log=$(mktemp); : >"$log"
    out=$("$here/run.exp" "$b" "$c" "$log" 2>&1)
    printf -- '--- %s\n%s\n' "$c" "$out"; sed 's/^/    log: /' "$log"; rm -f "$log"
  done
done
