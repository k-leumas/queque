#!/bin/sh
# Installs what QueQue needs on a fresh Linux distro image: git, zsh, jq, expect,
# procps and Node 24 (plus pnpm unless --no-pnpm). Shared by the CI distro legs,
# scripts/smoke-distro-runner.sh and local runs. POSIX sh, runs as root.
#
# Usage: sh scripts/ci/install-distro-deps.sh [--no-pnpm]
#
# Node source per distro (Phase 10 research, "Distro Install Matrix"):
#   alpine         apk nodejs npm (24.x on 3.23+)
#   ubuntu/debian  nodejs.org tarball pinned to NODE_VERSION or ./.nvmrc, checked
#                  against the release's SHASUMS256.txt (apt Node is 12/18/20)
#   fedora         dnf nodejs24 nodejs24-npm
#   arch           pacman nodejs-lts-krypton npm (plain `nodejs` is 26.x)
# pnpm comes from `npm install -g pnpm@VERSION` (VERSION from ./package.json
# packageManager); corepack is absent on Alpine and Arch.
#
# Exit codes: 2 unsupported distro or architecture, 3 install failure, 64 usage.
set -eu

WITH_PNPM=1
for arg in "$@"; do
  case "$arg" in
    --no-pnpm) WITH_PNPM=0 ;;
    -h | --help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *)
      echo "install-distro-deps: unknown argument: $arg" >&2
      exit 64
      ;;
  esac
done

die() {
  code=$1
  shift
  echo "install-distro-deps: $*" >&2
  exit "$code"
}

# Registry and CDN TLS flakes were seen inside containers: 3 attempts, 2 s then 5 s apart.
retry() {
  attempt=1
  while :; do
    if "$@"; then
      return 0
    fi
    if [ "$attempt" -ge 3 ]; then
      echo "install-distro-deps: failed after 3 attempts: $*" >&2
      return 1
    fi
    if [ "$attempt" -eq 1 ]; then sleep 2; else sleep 5; fi
    attempt=$((attempt + 1))
  done
}

install_node_tarball() {
  version=${NODE_VERSION:-}
  if [ -z "$version" ] && [ -f .nvmrc ]; then
    version=$(tr -d ' \t\r\n' <.nvmrc)
  fi
  [ -n "$version" ] || die 3 "set NODE_VERSION or run from a directory with .nvmrc ($(pwd))"
  version=${version#v}
  case "$version" in
    *[!0-9.]* | '') die 3 "invalid Node version: $version" ;;
  esac
  case "$(uname -m)" in
    x86_64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) die 2 "unsupported architecture: $(uname -m)" ;;
  esac
  name="node-v$version-linux-$arch.tar.xz"
  base="https://nodejs.org/dist/v$version"
  dir=$(mktemp -d)
  retry curl -fsSL -o "$dir/$name" "$base/$name" || die 3 "download failed: $base/$name"
  retry curl -fsSL -o "$dir/SHASUMS256.txt" "$base/SHASUMS256.txt" ||
    die 3 "download failed: $base/SHASUMS256.txt"
  # An empty grep feeds sha256sum no lines, which fails: the install fails closed.
  if ! (cd "$dir" && grep "  $name\$" SHASUMS256.txt | sha256sum -c -); then
    rm -rf "$dir"
    die 3 "checksum mismatch for $name"
  fi
  tar -xJf "$dir/$name" -C /usr/local --strip-components=1 --no-same-owner ||
    die 3 "could not extract $name"
  rm -rf "$dir"
}

[ -r /etc/os-release ] || die 2 "unsupported distro ID: no /etc/os-release"
# shellcheck disable=SC1091
. /etc/os-release
DISTRO_ID=${ID:-unknown}

case "$DISTRO_ID" in
  alpine)
    retry apk add --no-cache git zsh jq expect procps nodejs npm || die 3 "apk add failed"
    ;;
  ubuntu | debian)
    export DEBIAN_FRONTEND=noninteractive
    retry apt-get update || die 3 "apt-get update failed"
    retry apt-get install -y --no-install-recommends \
      git ca-certificates curl xz-utils zsh jq expect procps || die 3 "apt-get install failed"
    install_node_tarball
    ;;
  fedora)
    retry dnf -y install git-core zsh jq expect procps-ng shadow-utils nodejs24 nodejs24-npm ||
      die 3 "dnf install failed"
    if ! command -v node >/dev/null 2>&1; then
      ln -sf "$(command -v node-24)" /usr/local/bin/node || die 3 "node-24 not found"
      ln -sf "$(command -v npm-24)" /usr/local/bin/npm || die 3 "npm-24 not found"
    fi
    ;;
  arch)
    # Rolling distro: partial upgrades are unsupported, so -Syu.
    retry pacman -Syu --noconfirm --needed git zsh jq expect procps-ng nodejs-lts-krypton npm ||
      die 3 "pacman install failed"
    ;;
  *)
    die 2 "unsupported distro ID: $DISTRO_ID"
    ;;
esac

command -v node >/dev/null 2>&1 || die 3 "node is not on PATH after the install"

if [ "$WITH_PNPM" -eq 1 ]; then
  [ -f package.json ] || die 3 "no package.json in $(pwd) to read the pnpm version from"
  PNPM_VERSION=$(node -p "require('./package.json').packageManager.split('@')[1].split('+')[0]") ||
    die 3 "could not read packageManager from package.json"
  retry npm install -g "pnpm@$PNPM_VERSION" || die 3 "npm install -g pnpm@$PNPM_VERSION failed"
fi

echo "install-distro-deps: $DISTRO_ID node=$(node -v) jq=$(jq --version)" \
  "zsh=$(zsh --version | awk '{print $2}')"
