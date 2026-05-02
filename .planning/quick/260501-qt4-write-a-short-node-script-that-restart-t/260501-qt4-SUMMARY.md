# Quick Summary 260501-qt4

## Outcome

Added a small Node watcher script that restarts a dev command when files change and logs what it is doing.

## What Changed

- Added `scripts/restart-dev-server.mjs`.
- Added `pnpm dev:restart` in `package.json`.
- Documented the wrapper in `README.md`.

## Verification

- `node --check scripts/restart-dev-server.mjs`
- Live runtime check: started the watcher on a sleeping command, touched a file, and confirmed it logged the change and restart.

## Notes

- The script defaults to `pnpm dev`.
- It uses a polling scan so it avoids file-descriptor exhaustion from recursive watchers.
