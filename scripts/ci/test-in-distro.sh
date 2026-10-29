#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ci/test-in-distro.sh IMAGE [vitest args...]

Runs the vitest suite inside a fresh IMAGE container (e.g. alpine:3.24, debian:13):
`git archive HEAD` is extracted into /w, scripts/ci/install-distro-deps.sh installs
the distro dependencies, Node 24 and pnpm, then `pnpm install --frozen-lockfile`.
With no vitest args the whole suite runs (`pnpm test:run`); otherwise
`pnpm exec vitest run ARGS` (e.g. a list of test files).

Only committed files are tested: uncommitted changes are not in `git archive HEAD`.

Without Docker: a warning and exit 0 locally; exit 1 when CI is set, so a CI leg
can never pass by skipping.
EOF
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  '')
    usage >&2
    exit 2
    ;;
esac

IMAGE="$1"
shift

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! docker info >/dev/null 2>&1; then
  if [[ -n "${CI:-}" ]]; then
    echo "error: Docker is not available" >&2
    exit 1
  fi
  echo "warning: Docker is not available; skipping distro tests" >&2
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "warning: uncommitted changes are not included (the container gets git archive HEAD)" >&2
fi

# The vitest args reach the container script as positional parameters, never as
# script text.
set +e
# shellcheck disable=SC2016 # $# and $@ belong to the container's sh, not this shell.
git archive --format=tar HEAD | docker run --rm -i -e NODE_VERSION="$(cat .nvmrc)" "$IMAGE" sh -c '
set -eu
mkdir -p /w
cd /w
tar -xf -
sh scripts/ci/install-distro-deps.sh
LEFTHOOK=0 CI=true pnpm install --frozen-lockfile
if [ "$#" -eq 0 ]; then
  exec pnpm test:run
fi
exec pnpm exec vitest run "$@"
' test-in-distro "$@"
rc=$?
set -e
exit "$rc"
