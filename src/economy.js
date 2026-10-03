// Persist scheduling and action IDs; reacquire observed buildings each decision.
let pending = null;
let nextBuild = 0;
let zoned = false;
/** @param {import('../types/glob2-v2').ContextV2} ctx
 * @param {import('../types/glob2-v2').ManagedBuilding[]} buildings
 * @param {import('../types/glob2').Unit[]} units
 * @param {import('../types/glob2-v2').ManagedBuilding} home
 * @param {boolean} planConstruction */
export function economy(ctx, buildings, units, home, planConstruction) {
  const inns = buildings.filter((b) => b.shortType === 1);
  const wantedInns = Math.max(2, Math.ceil(units.length / 10));
  for (const b of buildings) {
    if (b.virtual) continue;
    const workers = b.construction
      ? 3
      : b.shortType === 0
        ? 1
        : b.shortType === 1
          ? 5
          : 2;
    // Read desired values, so a still-queued request need not be sent repeatedly.
    if (b.workers !== workers) b.workers = workers;
    // Feed the existing colony before spending wheat on new births.
    b.priority = b.shortType === 1 ? 1 : 0;
    if (b.shortType === 0) {
      /** @type {[number,number,number]} */
      const ratios =
        inns.length < wantedInns
          ? [4, 1, 0]
          : units.length < 24
            ? [6, 1, 1]
            : [5, 1, 3];
      if (b.production.some((v, i) => v !== ratios[i])) b.production = ratios;
    }
  }
  ctx.telemetry.set("economy.foodCapacityTarget", wantedInns, { unit: "inns" });
  // One construction project at a time keeps this example easy to reason about.
  if (pending !== null) {
    const status = ctx.actions.status(pending);
    if (status && ["pending", "issued", "constructing"].includes(status.status))
      return;
    ctx.telemetry.set(
      "construction.lastResult",
      status ? status.status : "expired",
    );
    pending = null;
  }
  // Keep native placement in its own scheduling slot, away from military scans.
  if (!planConstruction || ctx.tick < nextBuild) return;
  nextBuild = ctx.tick + 512;
  /** @type {import('../types/glob2').BuildingName|null} */
  let family = null;
  if (inns.length < wantedInns) family = "inn";
  else {
    // Pairs use stable building family codes (shortType), not variant IDs.
    const progression = [
      ["racetrack", 3],
      // Swimming lets workers harvest algae needed by schools.
      ["swimmingpool", 4],
      ["school", 6],
      ["barracks", 5],
      ["hospital", 2],
    ];
    for (const [name, id] of progression)
      if (!buildings.some((b) => b.shortType === id)) {
        family = /** @type {import('../types/glob2').BuildingName} */ (name);
        break;
      }
    if (
      !family &&
      units.length > 55 &&
      buildings.filter((b) => b.shortType === 0).length < 2
    )
      family = "swarm";
  }
  if (!family) return;
  const region = {
    x: home.x - 28,
    y: home.y - 28,
    width: Math.min(56, ctx.game.map.width),
    height: Math.min(56, ctx.game.map.height),
  };
  // Native code scans candidates and computes all fields; JS never loops over tiles.
  const request = {
    building: family,
    region,
    anchor: { x: home.x, y: home.y },
    reserveUpgrade: true,
    workers: 3,
    futureWorkers: 3,
    constraints: [
      {
        metric: "distance",
        sources: { resource: "wheat" },
        distanceMetric: "chebyshev",
        max: family === "inn" ? 14 : 28,
      },
    ],
    preferences: [
      {
        metric: "distance",
        sources: { points: [{ x: home.x, y: home.y }] },
        distanceMetric: "chebyshev",
        weight: -2,
      },
      { metric: "resourceDensity", resource: "wheat", radius: 8, weight: 3 },
      { metric: "fertility", radius: 4, weight: 1 },
    ],
  };
  pending = ctx.actions.build(
    /** @type {import('../types/glob2-v2').Placement} */ (request),
  );
  ctx.telemetry.set("construction.planned", family);
  ctx.telemetry.set("construction.foundSite", pending !== null);
  // A small guard zone demonstrates zoning without excluding valuable food.
  if (!zoned) {
    ctx.actions.zone({
      type: "guardArea",
      x: home.x,
      y: home.y,
      width: 3,
      height: 3,
      mode: 1,
      mask: [true, true, true, true, true, true, true, true, true],
    });
    zoned = true;
    ctx.telemetry.set("colony.guardZone", true);
  }
}
