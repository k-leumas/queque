#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-queque-homebrew-smoke:local}"
QUERY="${QQ_SMOKE_QUERY:-list files by size}"

usage() {
  cat <<'EOF'
Usage: scripts/smoke-homebrew-docker.sh [--no-cache]

Builds a Docker image from this checkout, installs QueQue in the same shape as
the generated Homebrew formula, then opens a real zsh PTY and types:

  list files by size??

Only the model is fake: the `claude` on PATH inside the container runs
tests/fixtures/fake-claude-stream.mjs, so no API key or token is read or passed.
The install, `qq init zsh`, the ZLE widget, client, daemon and TUI are real.

Options:
  --no-cache             Build every image layer from scratch (cold timing).
  -h, --help             Show this help.

Optional environment:
  QQ_SMOKE_QUERY         Intent typed before ??.
  IMAGE_NAME             Docker image tag to build/run.
  QQ_SMOKE_DOCKER_CACHE  Unset (default): plain `docker build` with the local
                         layer cache. `gha` (CI only): `docker buildx build
                         --load` with the GitHub Actions layer cache; needs a
                         docker-container buildx builder and the Actions
                         runtime variables. Any other value is an error.
EOF
}

NO_CACHE=0
for arg in "$@"; do
  case "$arg" in
    -h | --help)
      usage
      exit 0
      ;;
    --no-cache)
      NO_CACHE=1
      ;;
    *)
      echo "error: unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# Allow list: unset/empty or gha. Checked before any docker command runs.
case "${QQ_SMOKE_DOCKER_CACHE:-}" in
  '')
    BUILD_CMD=(docker build)
    BUILD_MODE="docker build"
    ;;
  gha)
    BUILD_CMD=(docker buildx build --load)
    BUILD_CMD+=(--cache-from "type=gha,scope=queque-homebrew-smoke")
    BUILD_CMD+=(--cache-to "type=gha,mode=max,scope=queque-homebrew-smoke,ignore-error=true")
    BUILD_MODE="docker buildx + gha cache"
    ;;
  *)
    echo "error: QQ_SMOKE_DOCKER_CACHE must be unset or gha" >&2
    exit 2
    ;;
esac
if [[ "$NO_CACHE" == 1 ]]; then
  BUILD_CMD+=(--no-cache)
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

# The same Node major as everything else (.nvmrc), like the formula's node@<major>.
NODE_MAJOR="$(tr -d 'v[:space:]' < .nvmrc | cut -d. -f1)"

# Layer order: deps first, then sources, so a src/ or shell/ change reuses the npm install
# layer. The build context is limited by the allow list in .dockerignore.
echo "building with $BUILD_MODE"
BUILD_START=$SECONDS
"${BUILD_CMD[@]}" --build-arg "NODE_MAJOR=$NODE_MAJOR" -t "$IMAGE_NAME" -f - . <<'DOCKERFILE'
ARG NODE_MAJOR

# The release commit bumps only package.json `version`. Stripping it here lets BuildKit's
# content-keyed `COPY --from` below reuse the npm install layer across releases.
FROM node:${NODE_MAJOR}-bookworm AS manifest
WORKDIR /manifest
COPY package.json ./
RUN node -e "const p = require('./package.json'); delete p.version; require('fs').writeFileSync('deps.json', JSON.stringify(p, null, 2) + '\n')"

FROM node:${NODE_MAJOR}-bookworm

ENV HOMEBREW_PREFIX=/home/linuxbrew/.linuxbrew
ENV PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update \
  && apt-get install -y --no-install-recommends zsh jq expect ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY --from=manifest /manifest/deps.json ./package.json
COPY pnpm-lock.yaml ./
RUN npm install --ignore-scripts --loglevel=error

# The real manifest overwrites the version-stripped one before the build.
COPY package.json tsconfig.json tsup.config.ts ./
COPY src ./src
COPY shell ./shell
RUN node_modules/.bin/tsup

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

# Last, so a runner edit rebuilds only these two layers.
COPY scripts/docker-homebrew-smoke-runner.sh /usr/local/bin/run-queque-homebrew-smoke
RUN chmod +x /usr/local/bin/run-queque-homebrew-smoke

CMD ["/usr/local/bin/run-queque-homebrew-smoke"]
DOCKERFILE
echo "image built in $((SECONDS - BUILD_START))s"

docker run --rm \
  -v "$ROOT_DIR/tests/fixtures/fake-claude-stream.mjs:/opt/fake/fake-claude-stream.mjs:ro" \
  -e QQ_NO_UPDATE_CHECK=1 \
  -e "QQ_SMOKE_QUERY=$QUERY" \
  "$IMAGE_NAME"
