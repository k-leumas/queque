---
created: 2026-10-30
title: "Bake the telemetry key and verify $ip/GeoIP absence (D-22)"
area: telemetry
source: 10-13-SUMMARY.md (keep-empty decision)
---

Deferred from Phase 10 plan 13: the user chose keep-empty, so every build ships an empty
`__QUEQUE_TELEMETRY_KEY__` and sends nothing.

Before baking, pick the backend. The client speaks PostHog `/batch/` (src/contracts/telemetry.ts):
- PostHog Cloud EU: no code change; create the project, enable "Discard client IP data", bake `phc_`.
- Aptabase, or an own endpoint (for example a Vercel Function writing to a Marketplace store):
  needs a configurable endpoint and a new payload builder; events and consent stay the same.

Then follow 10-13 Tasks 2-3: bake the key in tsup.config.ts only (vitest stays empty), send one
real `qq_environment` event through a scratch daemon shutdown flush, and confirm no `$ip`, no
GeoIP properties and no person profile. Consent carry-over from keyless builds is accepted
("carry-over ok", 2026-10-30), so no re-ask is needed.
