#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/smoke-distro.sh IMAGE [--out DIR]

Builds this checkout, packs it with `pnpm pack`, and installs the tarball with
`npm install -g` inside a fresh IMAGE container (e.g. alpine:3.24, debian:13).
A non-root user then types `??` into a real zsh PTY driven by expect, against
the installed widget, client, daemon and Ink TUI. Only the model is fake: the
`claude` on PATH runs tests/fixtures/fake-claude-stream.mjs. No API key or
token is read or passed into the container.

Arguments:
  IMAGE                  Docker image to test (required).
  --out DIR              Artifact directory (pty-*.log, qq-debug.log, ...).
                         Default: $QQ_SMOKE_OUT, else ${TMPDIR:-/tmp}/qq-smoke-SLUG
                         where SLUG is IMAGE with ':' and '/' replaced by '-'.

Exit status: the container's exit code (0 = PASS). See the exit-code comments in
scripts/smoke-distro-runner.sh and scripts/smoke-distro.exp.
EOF
}

IMAGE=""
OUT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --out)
      [[ $# -ge 2 ]] || {
        echo "error: --out needs a directory" >&2
        exit 2
      }
      OUT_DIR="$2"
      shift 2
      ;;
    --out=*)
      OUT_DIR="${1#--out=}"
      shift
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$IMAGE" ]]; then
        echo "error: only one IMAGE is accepted (got '$IMAGE' and '$1')" >&2
        exit 2
      fi
      IMAGE="$1"
      shift
      ;;
  esac
done

if [[ -z "$IMAGE" ]]; then
  usage >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${IMAGE//[:\/]/-}"
OUT_DIR="${OUT_DIR:-${QQ_SMOKE_OUT:-${TMPDIR:-/tmp}/qq-smoke-$SLUG}}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
rm -f "$OUT_DIR"/pty-*.log "$OUT_DIR/qq-debug.log"

cd "$ROOT_DIR"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

pnpm build
pnpm pack --pack-destination "$tmp/pkg"

set +e
docker run --rm \
  -v "$tmp/pkg:/pkg:ro" \
  -v "$ROOT_DIR/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro" \
  -v "$ROOT_DIR/scripts:/opt/qq-scripts:ro" \
  -v "$OUT_DIR:/out" \
  -e NODE_VERSION="$(cat .nvmrc)" \
  -e QQ_SMOKE_IMAGE="$IMAGE" \
  "$IMAGE" sh /opt/qq-scripts/smoke-distro-runner.sh
rc=$?
set -e

if [[ $rc -eq 0 ]]; then
  echo "smoke-distro: PASS $IMAGE"
else
  echo "smoke-distro: FAIL $IMAGE (exit $rc)"
  for log in "$OUT_DIR"/pty-*.log; do
    [[ -f "$log" ]] || continue
    echo "--- last 40 lines of $(basename "$log") ---"
    tail -n 40 "$log"
  done
fi
echo "smoke-distro: artifacts in $OUT_DIR"
exit "$rc"
