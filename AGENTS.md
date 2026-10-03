# Developing this Glob2 AI

Use Node.js 22 or newer. Run `npm ci`, `npm run build`, `npm run types`, `npm test`, and `GLOB2_BIN=/path/to/glob2 npm run check`.
Read README.md and types/glob2-v2.d.ts before changing strategy. Engine API profile 2
is required. Do not invent engine methods, variant IDs, or observation permissions.

Keep modules small and heavily commented. Explain why the policy acts and how it
uses the API. Maintain a complete colony lifecycle: food, construction, training,
upgrades, exploration, attacks and zoning. Prefer readable policy to clever tactics.

Only plain module data persists. Never keep managed building/field objects, runtime
closures, class instances, or native context objects in globals. Reacquire refs on
each callback. Use ctx.tick for scheduling, ctx.random for deterministic randomness,
and ctx.telemetry for diagnostics. No timers, filesystem, network or runtime imports.

Use native placement and spatial services. Treat no placement and rejected gameplay
orders as normal outcomes. Bound scans, inspect action status and account for queued
desired values versus observed values. Run ordinary fixed-seed games and save/resume
checks after strategy changes with `GLOB2_BIN=/absolute/path/to/glob2 npm run qualify`;
retain its evidence of all demonstrated capabilities. The scenario must exercise
completed upgrades and attacks, not merely run without exceptions.

Do not change the declaration copies independently: update from the engine revision
in engine.json and run scripts/check-api.mjs. Keep the bundler's atomic publish step.

`npm test` covers atomic publishing, rejection of runtime imports, and strict
continuation trace validation. Keep those checks in release CI as well as pull
requests. Qualification coverage is scenario-wide across both AI competitors;
telemetry about an attack or zone request is not proof that an order executed.
