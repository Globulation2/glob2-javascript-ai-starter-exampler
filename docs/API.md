# API recipes and execution model

The engine's checked-in declarations in `types/` describe argument shapes and
return values. `engine.json` pins their compatible engine revision. These notes
explain the decisions behind this example; consult the engine API reference for
complete bounds and numeric enums.

## One callback, one transaction

`step(ctx)` runs synchronously. Read observations, compute decisions, and edit
owned objects or call `ctx.actions`. Return nothing. Glob2 validates the resulting
module memory before committing it with RNG progress and queued actions. An
uncaught error disables that controller and retains the previous committed state.
Look at `runtime.status` and the engine log to diagnose it.

Requests are ordinary game orders and take time to dispatch. Property getters show
the desired queued setting; `building.observed` gives the actual last observation.
Assign the whole production tuple (`swarm.production = [5, 1, 3]`); returned arrays
are read-only. Repeated property writes coalesce without moving their queue slot.
Ownership, health, identity and enemy observations are read-only.

An explicit action returns an ID. Keep that ID in module memory and inspect
`ctx.actions.status(id)` on later decisions. Pending requests can be cancelled;
an issued order has already left the queue. Construction can fail after a valid
placement, for example when its site becomes occupied. Treat `failed` as a normal
planning outcome, and reconsider the world before trying again.

## Memory that survives saving

Ordinary top-level records, arrays, numbers, booleans and strings are saved
automatically, including variables from modules after bundling. Store an entity's
`ref`, then reacquire its managed object with `ctx.game.building(ref)`. A null result
means it is no longer an available matching entity; IDs alone can be reused.

Do not persist `ctx`, managed buildings, spatial fields, class instances, closures,
or functions created while the callback runs. Keep helper functions at module
scope. Source initialization and `metadata()` cannot inspect the world or draw
randomness. Use `ctx.random()` inside `step` when a policy needs deterministic
randomness. Clocks, runtime imports, timers, network and filesystem APIs are absent.

## Native map analysis

Coordinates wrap around the map edges. Prefer `ctx.spatial.distance` and
`displacement` over plain coordinate subtraction. A `distanceField` performs a
native multi-source search; query several locations with `fieldValue` during the
same callback. Select movement and metric deliberately: geometric proximity and
an obstacle-aware walking route answer different questions.

All results use the controller's observation view. Unknown tiles and unreachable
locations are distinct. Remembered fertility may be stale under fog; visible enemy
records are the only basis for military analysis. An observed hotspot is not a
claim that there are no enemies elsewhere.

Queries complete before returning and consume a deterministic work budget. Cache
hits pay the same logical cost as cold queries. A whole-map scan is not free on a
large map: schedule decisions with `ctx.tick`, restrict placement regions, and
reuse callback-local field handles. The example staggers economy, technology and
military decisions rather than invoking every expensive policy on every poll.

## Construction

Use `ctx.actions.build` for ordinary construction. Specify a family, a bounded
region, hard constraints, and weighted preferences. Positive weights favor larger
values, negative weights favor smaller values. Native code scores candidates and
uses deterministic ties. `ctx.spatial.placement` exposes the ranked candidates,
score terms and failure explanation without queuing construction.

The default solver protects upgrade footprints, checks access, and accounts for
pending construction reservations. `null` from `build` means no suitable observed
site exists. Do not turn that result into an exception. `military.js` also shows
exact-coordinate creation of an exploration flag, with a variant ID obtained from
`buildingTypes()` instead of a hard-coded engine index.

## Debug and qualify

Publish compact named values with `ctx.telemetry.set`. Use a stable prefix such as
`economy.` to group related fields. Current values, units and update ticks appear
in the common in-game AI telemetry dialog. During play only own/allied controllers
are available; spectating and replays show all controllers. New replay recordings
carry sampled telemetry without rerunning AI decisions.

`npm run check` verifies startup and the persistence contract, but cannot prove
that strategy plays a complete game. Test fixed maps/seeds, run ordinary matches,
and resume saves taken with queued construction. Compare full tick traces when
changing scheduling or memory. Keep the bundle used for each run: an active game
and its saves embed those bytes even after the linked development file changes.
