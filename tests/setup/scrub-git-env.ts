// git exports these into hook processes (lefthook's pre-push runs this suite), most visibly
// GIT_DIR from a linked worktree. Any test that spawns git with `...process.env` would then run
// against the repository being pushed instead of its temp fixture repo (Phase 10: core.bare=true
// and junk commits on the worktree branch). The list is `git rev-parse --local-env-vars`
// (git 2.54) plus the numbered GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n pairs GIT_CONFIG_COUNT uses.
const GIT_LOCAL_ENV_VARS = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
];

for (const name of Object.keys(process.env)) {
  if (GIT_LOCAL_ENV_VARS.includes(name) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(name)) {
    delete process.env[name];
  }
}
