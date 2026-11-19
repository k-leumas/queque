#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-queque-homebrew-smoke:local}"
QUERY="${QQ_SMOKE_QUERY:-list files by size}"

usage() {
  cat <<'EOF'
Usage: scripts/smoke-homebrew-docker.sh

Builds a Docker image from this checkout, installs QueQue in the same shape as
the generated Homebrew formula, then opens a real zsh PTY and types:

  list files by size??

Only the model is fake: the `claude` on PATH inside the container runs
tests/fixtures/fake-claude-stream.mjs, so no API key or token is read or passed.
The install, `qq init zsh`, the ZLE widget, client, daemon and TUI are real.

Optional environment:
  QQ_SMOKE_QUERY         Intent typed before ??.
  IMAGE_NAME             Docker image tag to build/run.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
#   (libexec/".../.install-source").write the homebrew install marker (byte-identical JSON;
#   tests/install-marker-formula.test.ts keeps all three copies in sync)
#   bin/"qq": a wrapper that execs node@<.nvmrc major> (the pinned dependency) on .../dist/cli/main.js
#   (share/"queque").install "shell/zsh/queque.zsh"
#   (share/"queque").install "shell/bash/queque.bash"
# The `test -f` lines fail the image build when an adapter is missing from share/queque.
RUN set -eux; \
  cellar="$HOMEBREW_PREFIX/Cellar/queque/local"; \
  libexec="$cellar/libexec"; \
  mkdir -p "$HOMEBREW_PREFIX/bin" "$HOMEBREW_PREFIX/share/queque" "$libexec"; \
  npm install --global --prefix "$libexec" --ignore-scripts --loglevel=error /src; \
  printf '%s' '{"source":"homebrew","upgrade":"brew upgrade queque"}' >"$libexec/lib/node_modules/@k-leumas/queque-cli/.install-source"; \
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
  -v "$ROOT_DIR/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro" \
  -e QQ_NO_UPDATE_CHECK=1 \
  -e "QQ_SMOKE_QUERY=$QUERY" \
  "$IMAGE_NAME"
