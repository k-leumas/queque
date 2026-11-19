#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-queque-homebrew-smoke:local}"
QUERY="${QQ_SMOKE_QUERY:-list files by size}"

usage() {
  cat <<'EOF'
Usage: scripts/smoke-homebrew-docker.sh

Builds a Docker image from this checkout, installs QueQue using the same shape
as the generated Homebrew formula, then opens an interactive zsh PTY and types:

  list files by size??

Required environment:
  ANTHROPIC_API_KEY      Anthropic key used by the live LLM request.

Also accepted:
  anthropic_api_key      Lowercase alias; exported to the container as
                         ANTHROPIC_API_KEY.
  .env.local             Fallback source for either key name.

Optional environment:
  QQ_SMOKE_QUERY         Intent typed before ??.
  IMAGE_NAME             Docker image tag to build/run.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

read_env_local_key() {
  local key="$1"
  local file="$ROOT_DIR/.env.local"
  [[ -f "$file" ]] || return 0

  awk -F= -v key="$key" '
    /^[[:space:]]*(export[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=/ {
      name = $1
      sub(/^[[:space:]]*export[[:space:]]+/, "", name)
      gsub(/[[:space:]]/, "", name)
      if (name == key) {
        value = substr($0, index($0, "=") + 1)
        sub(/^[[:space:]]*/, "", value)
        sub(/[[:space:]]*$/, "", value)
        if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
          value = substr(value, 2, length(value) - 2)
        }
        print value
        exit
      }
    }
  ' "$file"
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

API_KEY="${ANTHROPIC_API_KEY:-${anthropic_api_key:-}}"
if [[ -z "$API_KEY" ]]; then
  API_KEY="$(read_env_local_key ANTHROPIC_API_KEY)"
fi
if [[ -z "$API_KEY" ]]; then
  API_KEY="$(read_env_local_key anthropic_api_key)"
fi
if [[ -z "$API_KEY" ]]; then
  echo "error: set ANTHROPIC_API_KEY, anthropic_api_key, or add one to .env.local" >&2
  exit 2
fi

cd "$ROOT_DIR"

# The same Node major as everything else (.nvmrc), like the formula's node@<major>.
NODE_MAJOR="$(tr -d 'v[:space:]' < .nvmrc | cut -d. -f1)"

docker build --build-arg "NODE_MAJOR=$NODE_MAJOR" -t "$IMAGE_NAME" -f - . <<'DOCKERFILE'
ARG NODE_MAJOR
FROM node:${NODE_MAJOR}-bookworm

ENV HOMEBREW_PREFIX=/home/linuxbrew/.linuxbrew
ENV PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
  && apt-get install -y --no-install-recommends zsh jq expect ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY package.json pnpm-lock.yaml tsconfig.json tsup.config.ts ./
COPY src ./src
COPY shell ./shell
COPY scripts/docker-homebrew-smoke-runner.sh /usr/local/bin/run-queque-homebrew-smoke

RUN npm install --ignore-scripts --loglevel=error \
  && node_modules/.bin/tsup

# Local equivalent of the Homebrew formula install block from
# .github/workflows/homebrew.yml (and release.yaml):
#   npm install *std_npm_args
#   bin/"qq": a wrapper that execs node@<.nvmrc major> (the pinned dependency) on .../dist/cli/main.js
#   (share/"queque").install "shell/zsh/queque.zsh"
#   (share/"queque").install "shell/bash/queque.bash"
# The `test -f` lines fail the image build when an adapter is missing from share/queque.
RUN set -eux; \
  cellar="$HOMEBREW_PREFIX/Cellar/queque/local"; \
  libexec="$cellar/libexec"; \
  mkdir -p "$HOMEBREW_PREFIX/bin" "$HOMEBREW_PREFIX/share/queque" "$libexec"; \
  npm install --global --prefix "$libexec" --ignore-scripts --loglevel=error /src; \
  printf '#!/bin/bash\nexec "%s" "%s" "$@"\n' "$(command -v node)" "$libexec/lib/node_modules/@k-leumas/queque-cli/dist/cli/main.js" >"$HOMEBREW_PREFIX/bin/qq"; \
  cp /src/shell/zsh/queque.zsh "$HOMEBREW_PREFIX/share/queque/queque.zsh"; \
  cp /src/shell/bash/queque.bash "$HOMEBREW_PREFIX/share/queque/queque.bash"; \
  test -f "$HOMEBREW_PREFIX/share/queque/queque.zsh"; \
  test -f "$HOMEBREW_PREFIX/share/queque/queque.bash"; \
  chmod +x "$HOMEBREW_PREFIX/bin/qq"; \
  qq --version

RUN chmod +x /usr/local/bin/run-queque-homebrew-smoke

CMD ["/usr/local/bin/run-queque-homebrew-smoke"]
DOCKERFILE

docker run --rm \
  -e "ANTHROPIC_API_KEY=$API_KEY" \
  -e "QQ_SMOKE_QUERY=$QUERY" \
  "$IMAGE_NAME"
