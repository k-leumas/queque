#!/usr/bin/env bash
# Offline harness for .github/workflows/tap-clone-stats.yml (quick 261105-ix8).
#
# Runs the committed workflow's own `run:` bodies (extracted with PyYAML, not copied) against
# fixture API responses replayed by a fake `gh`, and a local file:// bare origin. No network, no
# token. The fake gh implements no logic under test: it only checks the request path and prints
# a fixture file. bash 3.2 compatible (macOS /bin/bash): no associative arrays, no mapfile.
#
# Usage: verify-tap-clone-stats.sh [case]
#   No argument runs every case. A case name runs the cases in order up to and including it
#   (later cases depend on the origin state that earlier ones leave behind).
set -euo pipefail

CASES="first-run overlap rerun-identical empty-clones api-failure ls-remote-failure"
ONLY=${1:-}
if [ -n "$ONLY" ]; then
  case " $CASES " in
    *" $ONLY "*) ;;
    *) echo "unknown case: $ONLY (known: $CASES)" >&2; exit 2 ;;
  esac
fi

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)
WF="$REPO/.github/workflows/tap-clone-stats.yml"
RELEASE_WF="$REPO/.github/workflows/release.yaml"
HOMEBREW_WF="$REPO/.github/workflows/homebrew.yml"

# ---------------------------------------------------------------- isolated environment
BASE=$(mktemp -d "${TMPDIR:-/tmp}/tap-clone-stats.XXXXXX")
: > "$BASE/gitconfig"
export GIT_CONFIG_GLOBAL="$BASE/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
unset GH_TOKEN GITHUB_TOKEN GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR \
  GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES || true

FAKE_BIN="$BASE/fake-bin"
mkdir -p "$FAKE_BIN"
cat > "$FAKE_BIN/gh" <<'GH'
#!/usr/bin/env bash
# Fixture replayer. Logs every path to $GH_CALL_LOG.
set -euo pipefail
die() { echo "unexpected gh call: $*" >&2; exit 1; }
[ "${1:-}" = api ] || die "$@"
shift
if [ "${1:-}" = --paginate ]; then shift; fi
[ $# -eq 1 ] || die "$@"
path=$1
echo "$path" >> "$GH_CALL_LOG"
runs_prefix='repos/k-leumas/queque/actions/workflows/'
jobs_prefix='repos/k-leumas/queque/actions/runs/'
case "$path" in
  'repos/k-leumas/homebrew-tap/traffic/clones?per=day')
    cat "$FIXTURE_DIR/clones.json"
    ;;
  "$runs_prefix"*'/runs?created=%3E%3D'*'&per_page=100')
    rest=${path#"$runs_prefix"}
    wf=${rest%%/runs\?*}
    since=${rest#*created=%3E%3D}
    since=${since%&per_page=100}
    if [ "$since" != "$FIXTURE_SINCE" ]; then
      echo "fake gh: since '$since' != expected '$FIXTURE_SINCE'" >&2
      exit 1
    fi
    [ -f "$FIXTURE_DIR/runs-$wf.json" ] || die "$path"
    cat "$FIXTURE_DIR/runs-$wf.json"
    ;;
  "$jobs_prefix"*'/jobs?filter=all&per_page=100')
    rest=${path#"$jobs_prefix"}
    id=${rest%%/jobs\?*}
    if [ ! -f "$FIXTURE_DIR/jobs-$id.json" ]; then
      echo "fake gh: HTTP 502 for $path" >&2
      exit 1
    fi
    cat "$FIXTURE_DIR/jobs-$id.json"
    ;;
  *) die "$path" ;;
esac
GH
chmod +x "$FAKE_BIN/gh"
export PATH="$FAKE_BIN:$PATH"

fail() { echo "FAIL ${CURRENT_CASE:-setup}: $*" >&2; exit 1; }

# ---------------------------------------------------------------- extract step bodies
STEPS_DIR="$BASE/steps"
mkdir -p "$STEPS_DIR"
python3 - "$WF" "$RELEASE_WF" "$HOMEBREW_WF" "$STEPS_DIR" <<'PY' || fail "workflow structure or drift guard"
import os, sys, yaml

wf_path, release_path, homebrew_path, out = sys.argv[1:5]
STEP = "Release to Homebrew tap"

def die(msg):
    sys.exit("structure: " + msg)

doc = yaml.safe_load(open(wf_path))
jobs = doc.get("jobs") or {}
if len(jobs) != 1:
    die("expected exactly one job, got %r" % list(jobs))
job = next(iter(jobs.values()))
if job.get("runs-on") != "ubuntu-24.04":
    die("runs-on is %r" % job.get("runs-on"))
env = doc.get("env") or {}
if env.get("TAP_REPO") != "k-leumas/homebrew-tap":
    die("TAP_REPO is %r" % env.get("TAP_REPO"))
if env.get("STATS_FILE") != "stats/tap-clones.json":
    die("STATS_FILE is %r" % env.get("STATS_FILE"))

steps = job.get("steps") or []
labels = [s.get("uses") or s.get("name") for s in steps]
expected = [
    "actions/checkout@v6",
    "Check out the stats branch",
    "Fetch clone traffic and publishing runs",
    "Write summary",
    "Commit snapshot",
]
if labels != expected:
    die("step order %r != %r" % (labels, expected))

for path in (release_path, homebrew_path):
    other = yaml.safe_load(open(path))
    names = [s.get("name") for j in other["jobs"].values() for s in j.get("steps", [])]
    if STEP not in names:
        die("drift: %s has no step named %r" % (os.path.basename(path), STEP))

fetch = steps[2]["run"]
for needle in ("release.yaml", "homebrew.yml", STEP):
    if needle not in fetch:
        die("drift: fetch step does not mention %r" % needle)

for key, step in zip(("checkout-stats", "fetch", "summary", "commit"), steps[1:]):
    with open(os.path.join(out, key + ".sh"), "w") as fh:
        fh.write(step["run"])
with open(os.path.join(out, "env"), "w") as fh:
    fh.write("%s\n%s\n" % (env["TAP_REPO"], env["STATS_FILE"]))
PY
WF_TAP_REPO=$(sed -n 1p "$STEPS_DIR/env")
WF_STATS_FILE=$(sed -n 2p "$STEPS_DIR/env")

# ---------------------------------------------------------------- local bare origin
ORIGIN="$BASE/origin.git"
SEED="$BASE/seed"
git init -q --bare "$ORIGIN"
git -C "$ORIGIN" symbolic-ref HEAD refs/heads/main
git init -q "$SEED"
mkdir -p "$SEED/.github/workflows"
echo "seed" > "$SEED/README"
printf 'name: a\non: push\n' > "$SEED/.github/workflows/a.yml"
git -C "$SEED" add README .github/workflows/a.yml
git -C "$SEED" -c user.name=t -c user.email=t@example.invalid commit -q -m seed
git -C "$SEED" push -q "file://$ORIGIN" HEAD:refs/heads/main
MAIN_SHA=$(git -C "$ORIGIN" rev-parse refs/heads/main)

# ---------------------------------------------------------------- fixtures
# $1 dir, $2 "skip103" to leave out jobs-103.json (api-failure)
write_publish_fixtures() {
  local d=$1
  mkdir -p "$d"
  # Two concatenated documents: what `gh api --paginate` prints for two pages.
  printf '%s\n%s\n' '{"total_count":4,"workflow_runs":[{"id":101},{"id":102}]}' \
    '{"total_count":4,"workflow_runs":[{"id":103},{"id":104}]}' > "$d/runs-release.yaml.json"
  echo '{"total_count":1,"workflow_runs":[{"id":201}]}' > "$d/runs-homebrew.yml.json"
  cat > "$d/jobs-101.json" <<'J'
{"total_count":2,"jobs":[
  {"name":"test","conclusion":"success"},
  {"name":"publish-homebrew","steps":[
    {"name":"Check existing Homebrew formula","conclusion":"success","started_at":"2026-10-20T09:00:00Z"},
    {"name":"Release to Homebrew tap","conclusion":"success","started_at":"2026-10-20T10:00:00Z"}
  ]}
]}
J
  cat > "$d/jobs-102.json" <<'J'
{"total_count":1,"jobs":[
  {"name":"publish-homebrew","steps":[
    {"name":"Release to Homebrew tap","conclusion":"skipped","started_at":"2026-10-21T09:00:00Z"}
  ]}
]}
J
  if [ "${2:-}" != skip103 ]; then
    cat > "$d/jobs-103.json" <<'J'
{"total_count":2,"jobs":[
  {"name":"publish-homebrew","run_attempt":1,"steps":[
    {"name":"Release to Homebrew tap","conclusion":"failure","started_at":"2026-10-21T08:00:00Z"}
  ]},
  {"name":"publish-homebrew","run_attempt":2,"steps":[
    {"name":"Release to Homebrew tap","conclusion":"success","started_at":"2026-10-21T08:30:00Z"}
  ]}
]}
J
  fi
  cat > "$d/jobs-104.json" <<'J'
{"total_count":1,"jobs":[
  {"name":"publish-homebrew","status":"in_progress","steps":[
    {"name":"Release to Homebrew tap","conclusion":null,"started_at":"2026-10-22T10:00:00Z"}
  ]}
]}
J
  cat > "$d/jobs-201.json" <<'J'
{"total_count":1,"jobs":[
  {"name":"homebrew","steps":[
    {"name":"Release to Homebrew tap","conclusion":"success","started_at":"2026-10-20T15:00:00Z"}
  ]}
]}
J
}

FIX_FIRST="$BASE/fixtures-first"
FIX_OVERLAP="$BASE/fixtures-overlap"
FIX_EMPTY="$BASE/fixtures-empty"
FIX_APIFAIL="$BASE/fixtures-apifail"
write_publish_fixtures "$FIX_FIRST"
write_publish_fixtures "$FIX_OVERLAP"
write_publish_fixtures "$FIX_EMPTY"
write_publish_fixtures "$FIX_APIFAIL" skip103
cat > "$FIX_FIRST/clones.json" <<'J'
{"count":8,"uniques":5,"clones":[
  {"timestamp":"2026-10-20T00:00:00Z","count":4,"uniques":3},
  {"timestamp":"2026-10-21T00:00:00Z","count":1,"uniques":1},
  {"timestamp":"2026-10-22T00:00:00Z","count":3,"uniques":2}
]}
J
cat > "$FIX_OVERLAP/clones.json" <<'J'
{"count":9,"uniques":6,"clones":[
  {"timestamp":"2026-10-21T00:00:00Z","count":5,"uniques":4},
  {"timestamp":"2026-10-22T00:00:00Z","count":3,"uniques":2},
  {"timestamp":"2026-10-23T00:00:00Z","count":1,"uniques":1}
]}
J
cp "$FIX_OVERLAP/clones.json" "$FIX_APIFAIL/clones.json"
echo '{"count":0,"uniques":0,"clones":[]}' > "$FIX_EMPTY/clones.json"

# ---------------------------------------------------------------- step runner
# run_step <case dir> <fixture dir> <since> <step key>; output in <case dir>/<key>.log
run_step() {
  local cdir=$1 fdir=$2 since=$3 key=$4
  (
    cd "$cdir/ws"
    export TAP_REPO="$WF_TAP_REPO" STATS_FILE="$WF_STATS_FILE" CI_REPO=k-leumas/queque
    export GITHUB_STEP_SUMMARY="$cdir/summary.md"
    export FIXTURE_DIR="$fdir" FIXTURE_SINCE="$since" GH_CALL_LOG="$cdir/gh-calls.log"
    bash --noprofile --norc -eo pipefail "$STEPS_DIR/$key.sh"
  ) > "$cdir/$key.log" 2>&1
}

# Simulate actions/checkout, then run the four steps in order, stopping at the first failure
# like Actions does. Sets RAN_STEPS and FAILED_STEP.
run_workflow() {
  local cdir=$1 fdir=$2 since=$3 key
  git clone -q --depth 1 --branch main "file://$ORIGIN" "$cdir/ws"
  : > "$cdir/gh-calls.log"
  : > "$cdir/summary.md"
  RAN_STEPS=""
  FAILED_STEP=""
  for key in checkout-stats fetch summary commit; do
    RAN_STEPS="$RAN_STEPS $key"
    if ! run_step "$cdir" "$fdir" "$since" "$key"; then
      FAILED_STEP=$key
      return 0
    fi
  done
}

new_case_dir() { mktemp -d "$BASE/case-$1.XXXXXX"; }
stats_count() { git -C "$ORIGIN" rev-list --count refs/heads/stats; }
origin_file() { git -C "$ORIGIN" show "refs/heads/stats:$WF_STATS_FILE"; }
assert_tree_only_stats_file() {
  local tree
  tree=$(git -C "$ORIGIN" ls-tree -r --name-only refs/heads/stats)
  [ "$tree" = "$WF_STATS_FILE" ] || fail "stats tree is '$tree'"
}
assert_json() { # file expected-json
  jq -e --argjson exp "$2" '. == $exp' "$1" > /dev/null || fail "JSON mismatch in $1: $(cat "$1")"
}
assert_line() { # file line
  grep -qxF -- "$2" "$1" || fail "missing line '$2' in $1: $(cat "$1")"
}
assert_ran_ok() { # cdir
  [ -z "$FAILED_STEP" ] || fail "step $FAILED_STEP failed: $(cat "$1/$FAILED_STEP.log")"
}

NOTE='Adjusted is an upper bound: other automated fetches (brew update, for example) may also count as clones.'
EXP_OVERLAP='{
  "2026-10-20":{"count":4,"uniques":3,"release_clones":2,"adjusted_count":2,"adjusted_uniques":1},
  "2026-10-21":{"count":5,"uniques":4,"release_clones":2,"adjusted_count":3,"adjusted_uniques":2},
  "2026-10-22":{"count":3,"uniques":2,"release_clones":0,"adjusted_count":3,"adjusted_uniques":2},
  "2026-10-23":{"count":1,"uniques":1,"release_clones":0,"adjusted_count":1,"adjusted_uniques":1}
}'

# ---------------------------------------------------------------- cases
case_first_run() {
  local c
  c=$(new_case_dir first-run)
  if git ls-remote --exit-code --heads "file://$ORIGIN" stats > /dev/null 2>&1; then
    fail "origin already has stats"
  fi
  run_workflow "$c" "$FIX_FIRST" 2026-10-20
  assert_ran_ok "$c"
  assert_json "$c/ws/$WF_STATS_FILE" '{
    "2026-10-20":{"count":4,"uniques":3,"release_clones":2,"adjusted_count":2,"adjusted_uniques":1},
    "2026-10-21":{"count":1,"uniques":1,"release_clones":2,"adjusted_count":0,"adjusted_uniques":0},
    "2026-10-22":{"count":3,"uniques":2,"release_clones":0,"adjusted_count":3,"adjusted_uniques":2}
  }'
  assert_line "$c/summary.md" '| Raw | 3 | 8 | 6 |'
  assert_line "$c/summary.md" '| Adjusted (publishing runs subtracted) | 3 | 5 | 3 |'
  assert_line "$c/summary.md" "$NOTE"
  [ "$(stats_count)" = 1 ] || fail "stats has $(stats_count) commits"
  local parents
  parents=$(git -C "$ORIGIN" rev-list --parents -n 1 refs/heads/stats | wc -w | tr -d ' ')
  [ "$parents" = 1 ] || fail "stats commit has a parent"
  assert_tree_only_stats_file
  local subject author
  subject=$(git -C "$ORIGIN" log -1 --format=%s refs/heads/stats)
  author=$(git -C "$ORIGIN" log -1 --format=%an refs/heads/stats)
  [ "$subject" = "chore: tap clone stats $(date -u +%F)" ] || fail "subject is '$subject'"
  [ "$author" = 'github-actions[bot]' ] || fail "author is '$author'"
  [ "$(git -C "$ORIGIN" rev-parse refs/heads/main)" = "$MAIN_SHA" ] || fail "origin main moved"
  FIRST_SHA=$(git -C "$ORIGIN" rev-parse refs/heads/stats)
}

case_overlap() {
  local c
  c=$(new_case_dir overlap)
  run_workflow "$c" "$FIX_OVERLAP" 2026-10-21
  assert_ran_ok "$c"
  assert_json "$c/ws/$WF_STATS_FILE" "$EXP_OVERLAP"
  assert_line "$c/summary.md" '| Raw | 4 | 13 | 10 |'
  assert_line "$c/summary.md" '| Adjusted (publishing runs subtracted) | 4 | 9 | 6 |'
  [ "$(stats_count)" = 2 ] || fail "stats has $(stats_count) commits"
  [ "$(git -C "$ORIGIN" rev-parse 'refs/heads/stats^')" = "$FIRST_SHA" ] || fail "not a fast-forward"
  assert_tree_only_stats_file
  OVERLAP_COPY="$c/after-overlap.json"
  origin_file > "$OVERLAP_COPY"
}

case_rerun_identical() {
  local c
  c=$(new_case_dir rerun-identical)
  run_workflow "$c" "$FIX_OVERLAP" 2026-10-21
  assert_ran_ok "$c"
  [ "$(stats_count)" = 2 ] || fail "identical re-run committed (stats has $(stats_count))"
  cmp -s "$c/ws/$WF_STATS_FILE" "$OVERLAP_COPY" || fail "workspace file differs from overlap"
  origin_file | cmp -s - "$OVERLAP_COPY" || fail "origin file differs from overlap"
}

case_empty_clones() {
  local c
  c=$(new_case_dir empty-clones)
  run_workflow "$c" "$FIX_EMPTY" unused
  assert_ran_ok "$c"
  grep -qF 'No clone data returned' "$c/fetch.log" || fail "no empty-data message: $(cat "$c/fetch.log")"
  local calls
  calls=$(cat "$c/gh-calls.log")
  [ "$calls" = 'repos/k-leumas/homebrew-tap/traffic/clones?per=day' ] || fail "gh calls: $calls"
  origin_file | cmp -s - "$OVERLAP_COPY" || fail "file changed"
  cmp -s "$c/ws/$WF_STATS_FILE" "$OVERLAP_COPY" || fail "workspace file changed"
  [ "$(stats_count)" = 2 ] || fail "stats has $(stats_count) commits"
}

case_api_failure() {
  local c
  c=$(new_case_dir api-failure)
  run_workflow "$c" "$FIX_APIFAIL" 2026-10-21
  [ "$FAILED_STEP" = fetch ] || fail "expected fetch to fail, failed step is '${FAILED_STEP:-none}'"
  [ "$RAN_STEPS" = ' checkout-stats fetch' ] || fail "later steps ran:$RAN_STEPS"
  grep -q 'actions/runs/103/jobs' "$c/gh-calls.log" || fail "jobs-103 was never requested"
  [ "$(stats_count)" = 2 ] || fail "stats has $(stats_count) commits"
  cmp -s "$c/ws/$WF_STATS_FILE" "$OVERLAP_COPY" || fail "workspace file was rewritten"
}

case_ls_remote_failure() {
  local c
  c=$(new_case_dir ls-remote-failure)
  git clone -q --depth 1 --branch main "file://$ORIGIN" "$c/ws"
  git -C "$c/ws" remote set-url origin file:///nonexistent/missing.git
  : > "$c/gh-calls.log"
  if run_step "$c" "$FIX_OVERLAP" unused checkout-stats; then
    fail "checkout-stats succeeded against a missing origin"
  fi
  if git -C "$c/ws" rev-parse --verify -q refs/heads/stats > /dev/null; then
    fail "a local stats branch was created"
  fi
  [ "$(git -C "$c/ws" rev-parse --abbrev-ref HEAD)" = main ] || fail "workspace left main"
}

# ---------------------------------------------------------------- driver
FIRST_SHA=""
OVERLAP_COPY=""
for CURRENT_CASE in $CASES; do
  fn="case_$(echo "$CURRENT_CASE" | tr '-' '_')"
  "$fn"
  echo "PASS $CURRENT_CASE"
  [ "$CURRENT_CASE" = "$ONLY" ] && break
done
CURRENT_CASE=final
[ "$(git -C "$ORIGIN" rev-parse refs/heads/main)" = "$MAIN_SHA" ] || fail "origin main moved"
if [ -z "$ONLY" ]; then
  echo "ALL PASS"
else
  echo "PASS through $ONLY"
fi
