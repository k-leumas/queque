#!/usr/bin/env bash
# Auto-revert on smoke failure (D-15). Run by the `auto-revert` job in ci.yml after a push
# whose distro job failed. When at least one smoke leg failed, it restores the branch's last
# green tree on the fixed branch `auto-revert/<branch with / replaced by ->` and opens (or
# updates) one pull request against the branch. The body lists the failing distros, the run
# URL, and each failing distro's doctor.json and log tails. Deterministic shell plus `gh`;
# no LLM involvement.
#
# Inputs come only from the environment, never from argv or workflow-expression text:
#   REPO           owner/name                                         (required)
#   BRANCH         the pushed branch (github.ref_name)                (required)
#   HEAD_SHA       the pushed commit (github.sha)                     (required)
#   BEFORE_SHA     the push's previous tip (github.event.before; zeros for a new branch)
#   RUN_ID         this workflow run's id                             (required)
#   RUN_URL        link to this run, for the PR body
#   ARTIFACTS_DIR  where actions/download-artifact put smoke-IMAGE_SLUG (default artifacts)
#   REMOTE         git remote to push to and to read main from        (default origin)
#   WORKFLOW_FILE  workflow whose runs count as green                 (default ci.yml)
#   MAX_ANCESTORS  first-parent ancestors to check for a green run    (default 30)
#   GH_TOKEN       read by gh itself: the workflow's GITHUB_TOKEN (D-21), never a PAT
#
# Last green base, first match wins:
#   1. the newest successful push run of WORKFLOW_FILE on BRANCH whose smoke jobs ran and
#      passed and whose head is an ancestor of HEAD_SHA (a doc-only run whose smoke was
#      skipped still contains the breakage, so it never counts)
#   2. the nearest first-parent ancestor of HEAD_SHA^ (up to MAX_ANCESTORS) with such a run,
#      on any branch
#   3. BEFORE_SHA, when it is not all zeros and is an ancestor of HEAD_SHA
#   4. the merge base with REMOTE/main, when BRANCH is not main
#   Otherwise it prints a ::warning:: and reverts nothing.
#
# The revert is a tree restore, so merge commits and files added after the green commit are
# handled. Files under .github/workflows stay at HEAD: the workflow token cannot push
# workflow changes, and the PR body says so.
#
# Exit 0 for every "nothing to do" outcome, 1 for invalid input; a git or gh failure while
# reverting fails the job.

# Backticks inside single-quoted printf formats are Markdown code spans, not expansions.
# shellcheck disable=SC2016
set -euo pipefail

REPO=${REPO:-}
BRANCH=${BRANCH:-}
HEAD_SHA=${HEAD_SHA:-}
BEFORE_SHA=${BEFORE_SHA:-}
RUN_ID=${RUN_ID:-}
RUN_URL=${RUN_URL:-}
ARTIFACTS_DIR=${ARTIFACTS_DIR:-artifacts}
REMOTE=${REMOTE:-origin}
WORKFLOW_FILE=${WORKFLOW_FILE:-ci.yml}
MAX_ANCESTORS=${MAX_ANCESTORS:-30}

BODY_MAX_CHARS=60000
EXCERPT_LINES=80
SMOKE_RE='(^|/ )smoke \('
SHA_RE='^[0-9a-f]{40}([0-9a-f]{24})?$'
REPO_RE='^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$'
NAME_RE='^[A-Za-z0-9._-]+$'
WORKFLOWS_DIR='.github/workflows'
BOT_NAME='github-actions[bot]'
BOT_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'
ESC=$'\033'
BEL=$'\007'

log() { printf 'auto-revert: %s\n' "$*"; }
die() {
  printf 'auto-revert: %s\n' "$*" >&2
  exit 1
}

# Loop guard before anything else: a revert branch is never itself reverted.
case "$BRANCH" in
  auto-revert/*)
    log "$BRANCH is an auto-revert branch; nothing to do"
    exit 0
    ;;
esac

[ -n "$BRANCH" ] || die "BRANCH is not set"
git check-ref-format --branch "$BRANCH" >/dev/null 2>&1 || die "not a valid branch name: $BRANCH"
[[ $REPO =~ $REPO_RE ]] || die "REPO must be owner/name"
[[ $HEAD_SHA =~ $SHA_RE ]] || die "HEAD_SHA must be a full commit SHA"
case "$RUN_ID" in '' | *[!0-9]*) die "RUN_ID must be a number" ;; esac
case "$MAX_ANCESTORS" in '' | *[!0-9]*) die "MAX_ANCESTORS must be a number" ;; esac
[[ $REMOTE =~ $NAME_RE ]] || die "invalid REMOTE: $REMOTE"
[[ $WORKFLOW_FILE =~ $NAME_RE ]] || die "invalid WORKFLOW_FILE: $WORKFLOW_FILE"

case "$ARTIFACTS_DIR" in
  /*) ;;
  *) ARTIFACTS_DIR="$PWD/$ARTIFACTS_DIR" ;;
esac
TOP=$(git rev-parse --show-toplevel) || die "not inside a git work tree"
cd "$TOP"
git rev-parse --verify --quiet "$HEAD_SHA^{commit}" >/dev/null || die "unknown commit: $HEAD_SHA"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/auto-revert.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
BODY_FILE="$WORK/body.md"

is_sha() { [[ $1 =~ $SHA_RE ]]; }
is_ancestor_of_head() { git merge-base --is-ancestor "$1" "$HEAD_SHA" 2>/dev/null; }

# Prints the names of RUN's smoke jobs whose conclusion is one of WANT (comma-separated).
smoke_jobs() {
  gh api "repos/$REPO/actions/runs/$1/jobs?per_page=100" --paginate |
    jq -r --arg re "$SMOKE_RE" --arg want "$2" \
      '.jobs[]? | select((.name | test($re)) and ((.conclusion // "") | IN($want | split(",")[]))) | .name'
}

# True when at least one smoke job of RUN ran and succeeded.
smoke_passed() {
  local names
  names=$(smoke_jobs "$1" success) || return 1
  [ -n "$names" ]
}

# Prints "ID HEAD_SHA" per successful push run of WORKFLOW_FILE for the given query.
green_runs() {
  gh api "repos/$REPO/actions/workflows/$WORKFLOW_FILE/runs?$1&event=push&status=success&per_page=20" |
    jq -r '.workflow_runs[]? | "\(.id) \(.head_sha)"'
}

# --- Which smoke legs failed in this run (D-15 reverts on smoke failures only) ---
failing=$(smoke_jobs "$RUN_ID" 'failure,timed_out')
if [ -z "$failing" ]; then
  log "no smoke failure in this run; nothing to revert"
  exit 0
fi

image_of() {
  local name=$1
  name=${name##*"smoke ("}
  printf '%s' "${name%)}"
}

DISTROS=""
failing_count=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  DISTROS="${DISTROS:+$DISTROS, }$(image_of "$name")"
  failing_count=$((failing_count + 1))
done <<<"$failing"
log "smoke failed on: $DISTROS"

# --- Last green base ---
GOOD=""
GOOD_RULE=""

branch_query=$(jq -rn --arg b "$BRANCH" '$b | @uri')
if runs=$(green_runs "branch=$branch_query"); then
  while read -r id sha <&3; do
    [ -n "$id" ] || continue
    case "$id" in *[!0-9]*) continue ;; esac
    is_sha "$sha" || continue
    [ "$sha" != "$HEAD_SHA" ] || continue
    is_ancestor_of_head "$sha" || continue
    if smoke_passed "$id"; then
      GOOD=$sha
      GOOD_RULE="the newest successful push run on \`$BRANCH\` whose smoke jobs passed (run $id)"
      break
    fi
  done 3<<<"$runs"
else
  log "could not list the branch's runs; trying ancestors"
fi

if [ -z "$GOOD" ]; then
  ancestors=$(git rev-list --first-parent --max-count="$MAX_ANCESTORS" "$HEAD_SHA^" 2>/dev/null || true)
  while read -r sha <&4; do
    [ -n "$sha" ] || continue
    runs=$(green_runs "head_sha=$sha") || continue
    while read -r id _ <&3; do
      case "$id" in '' | *[!0-9]*) continue ;; esac
      if smoke_passed "$id"; then
        GOOD=$sha
        GOOD_RULE="the nearest first-parent ancestor with a successful push run whose smoke jobs passed (run $id)"
        break
      fi
    done 3<<<"$runs"
    [ -z "$GOOD" ] || break
  done 4<<<"$ancestors"
fi

if [ -z "$GOOD" ] && is_sha "$BEFORE_SHA" && [[ ! $BEFORE_SHA =~ ^0+$ ]] &&
  [ "$BEFORE_SHA" != "$HEAD_SHA" ] && is_ancestor_of_head "$BEFORE_SHA"; then
  GOOD=$BEFORE_SHA
  GOOD_RULE="the push's before SHA (no green run was found, so this base is not verified green)"
fi

if [ -z "$GOOD" ] && [ "$BRANCH" != main ]; then
  if base=$(git merge-base "$REMOTE/main" "$HEAD_SHA" 2>/dev/null) && [ "$base" != "$HEAD_SHA" ]; then
    GOOD=$base
    GOOD_RULE="the merge base with \`main\` (no green run was found, so this base is not verified green)"
  fi
fi

if [ -z "$GOOD" ]; then
  echo "::warning::no green base found for $BRANCH; not reverting"
  exit 0
fi
log "last green base: $GOOD"

if [ "$(git rev-parse "$GOOD^{tree}")" = "$(git rev-parse "$HEAD_SHA^{tree}")" ]; then
  log "$HEAD_SHA has the same tree as $GOOD; nothing to revert"
  exit 0
fi

KEEP_WORKFLOWS=0
if ! git diff --quiet "$GOOD" "$HEAD_SHA" -- "$WORKFLOWS_DIR"; then
  KEEP_WORKFLOWS=1
fi

GOOD_SHORT=${GOOD:0:7}
HEAD_SHORT=${HEAD_SHA:0:7}
HEAD_BRANCH="auto-revert/${BRANCH//\//-}"
REVERTED=$(git rev-list --count "$GOOD..$HEAD_SHA")

# --- PR body (built before the checkout moves anything) ---

# Drops ANSI CSI/OSC/charset sequences, then every other control character except tab and
# newline, and shortens backtick runs so log text cannot close the four-backtick fence.
sanitize() {
  LC_ALL=C sed -E \
    -e "s#${ESC}\\[[0-?]*[ -/]*[@-~]##g" \
    -e "s#${ESC}\\][^${BEL}${ESC}]*(${BEL}|${ESC}\\\\)?##g" \
    -e "s#${ESC}[()][0-9A-Za-z]##g" \
    -e 's#`{4,}#```#g' |
    LC_ALL=C tr -d '\000-\010\013-\037\177'
}

# Per-file excerpt budget: about 48000 bytes shared by four files per failing distro.
EXCERPT_MAX_BYTES=$((48000 / (failing_count * 4)))
[ "$EXCERPT_MAX_BYTES" -le 8000 ] || EXCERPT_MAX_BYTES=8000
[ "$EXCERPT_MAX_BYTES" -ge 1500 ] || EXCERPT_MAX_BYTES=1500

# fenced TITLE FILE head|tail
fenced() {
  local excerpt="$WORK/excerpt"
  if [ "$3" = head ]; then
    sanitize <"$2" | head -c "$EXCERPT_MAX_BYTES" >"$excerpt"
  else
    tail -n "$EXCERPT_LINES" "$2" | sanitize | tail -c "$EXCERPT_MAX_BYTES" >"$excerpt"
  fi
  printf '<details><summary>%s</summary>\n\n````\n' "$1"
  cat "$excerpt"
  if [ -s "$excerpt" ] && [ -n "$(tail -c 1 "$excerpt")" ]; then
    printf '\n'
  fi
  printf '````\n\n</details>\n\n'
}

# Prints the artifact directory for IMAGE, or nothing.
artifact_dir() {
  local image=$1 slug
  slug=$(printf '%s' "$image" | tr ':/' '--')
  if [ -d "$ARTIFACTS_DIR/smoke-$slug" ]; then
    printf '%s' "$ARTIFACTS_DIR/smoke-$slug"
  elif [ -f "$ARTIFACTS_DIR/image.txt" ] && [ "$(head -n 1 "$ARTIFACTS_DIR/image.txt")" = "$image" ]; then
    # download-artifact extracts a lone matching artifact straight into its path.
    printf '%s' "$ARTIFACTS_DIR"
  fi
}

{
  printf '## Smoke failed on `%s` at `%s`\n\n' "$BRANCH" "$HEAD_SHORT"
  printf 'This pull request puts `%s` back to the tree of its last green commit `%s`. ' "$BRANCH" "$GOOD_SHORT"
  printf 'CI opened it (`scripts/ci/auto-revert.sh`, D-15): merge it to revert, or close it and push a fix. '
  printf 'Another smoke failure on `%s` updates this pull request instead of opening a new one.\n\n' "$BRANCH"
  printf -- '- **Failing smoke jobs:**'
  sep=' '
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    printf '%s`%s`' "$sep" "$name"
    sep=', '
  done <<<"$failing"
  printf '\n'
  printf -- '- **Run:** %s\n' "${RUN_URL:-(not given)}"
  printf -- '- **Restored to:** `%s`, chosen as %s\n' "$GOOD" "$GOOD_RULE"
  printf -- '- **Reverted:** `%s..%s` (%s commits)\n' "$GOOD_SHORT" "$HEAD_SHORT" "$REVERTED"
  if [ "$KEEP_WORKFLOWS" = 1 ]; then
    printf -- '- **Kept at `%s`:** files under `%s`. The workflow token cannot push workflow changes, so revert those by hand if they caused the failure.\n' "$HEAD_SHORT" "$WORKFLOWS_DIR"
  fi
  printf '\n> [!NOTE]\n'
  printf "> This pull request was opened with the workflow's \`GITHUB_TOKEN\` (D-21), so GitHub does not start its checks on its own. "
  printf 'A maintainer must approve its workflow run (**Approve and run workflows**) for the checks to report.\n\n'
  printf '### Diagnostics\n\n'
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    image=$(image_of "$name")
    printf '#### %s\n\n' "$image"
    dir=$(artifact_dir "$image")
    if [ -z "$dir" ]; then
      printf '_No smoke artifacts were downloaded for this distro._\n\n'
      continue
    fi
    [ ! -f "$dir/doctor.json" ] || fenced 'doctor.json' "$dir/doctor.json" head
    for file in "$dir"/pty-*.log "$dir/qq-debug.log" "$dir/df.txt"; do
      [ -f "$file" ] || continue
      fenced "$(basename "$file") (last $EXCERPT_LINES lines)" "$file" tail
    done
  done <<<"$failing"
} >"$BODY_FILE"

# Caps the body below GitHub's 65536-character limit, closing any fence or <details> the cut
# left open, and drops bytes that are not valid UTF-8 after a mid-character cut.
count_lines() { grep -c "$1" "$BODY_FILE.cut" || true; }
size=$(wc -c <"$BODY_FILE" | tr -d ' ')
if [ "$size" -gt "$BODY_MAX_CHARS" ]; then
  head -c $((BODY_MAX_CHARS - 400)) "$BODY_FILE" | sed '$d' >"$BODY_FILE.cut"
  if [ $(($(count_lines '^````') % 2)) -ne 0 ]; then
    printf '````\n' >>"$BODY_FILE.cut"
  fi
  open_details=$(($(count_lines '^<details>') - $(count_lines '^</details>')))
  while [ "$open_details" -gt 0 ]; do
    printf '\n</details>\n' >>"$BODY_FILE.cut"
    open_details=$((open_details - 1))
  done
  printf '\n_Body truncated to stay under the GitHub size limit; the full logs are in the run artifacts._\n' >>"$BODY_FILE.cut"
  mv "$BODY_FILE.cut" "$BODY_FILE"
fi
if command -v iconv >/dev/null 2>&1 && iconv -c -f UTF-8 -t UTF-8 <"$BODY_FILE" >"$BODY_FILE.utf8" 2>/dev/null; then
  mv "$BODY_FILE.utf8" "$BODY_FILE"
fi

# --- Revert commit on the fixed head branch ---
git switch --quiet -C "$HEAD_BRANCH" "$HEAD_SHA"
git restore --source="$GOOD" --staged --worktree -- .
if [ "$KEEP_WORKFLOWS" = 1 ]; then
  git restore --source="$HEAD_SHA" --staged --worktree -- "$WORKFLOWS_DIR"
fi
if git diff --cached --quiet; then
  log "only files under $WORKFLOWS_DIR differ from $GOOD; nothing the workflow token can revert"
  exit 0
fi
git -c user.name="$BOT_NAME" -c user.email="$BOT_EMAIL" commit --quiet \
  -m "revert: restore $BRANCH to last green $GOOD_SHORT" \
  -m "Smoke failed at $HEAD_SHORT on: $DISTROS"
git push --quiet --force "$REMOTE" "HEAD:refs/heads/$HEAD_BRANCH"
log "pushed $HEAD_BRANCH"

# --- One pull request per source branch: edit the open one, else create it ---
TITLE="revert: smoke failed on $BRANCH at $HEAD_SHORT"
existing=$(gh pr list --repo "$REPO" --head "$HEAD_BRANCH" --state open --json number --jq '.[0].number // empty')
existing=${existing%%$'\n'*}
case "$existing" in
  *[!0-9]*) die "unexpected pr list output: $existing" ;;
esac
if [ -n "$existing" ]; then
  gh pr edit "$existing" --repo "$REPO" --title "$TITLE" --body-file "$BODY_FILE"
  gh pr comment "$existing" --repo "$REPO" --body "Smoke failed again at $HEAD_SHORT: ${RUN_URL:-run $RUN_ID}"
  log "updated pull request #$existing"
else
  gh pr create --repo "$REPO" --base "$BRANCH" --head "$HEAD_BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
  log "opened a pull request for $HEAD_BRANCH"
fi
