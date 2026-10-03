let exploration = null,
  attack = null,
  direction = 0;
/** @param {import('../types/glob2-v2').ContextV2} ctx
 * @param {import('../types/glob2-v2').ManagedBuilding[]} buildings
 * @param {import('../types/glob2').Unit[]} units
 * @param {import('../types/glob2-v2').ManagedBuilding} home */
export function military(ctx, buildings, units, home) {
  const explorer = buildings.find((b) => b.shortType === 8);
  const war = buildings.find((b) => b.shortType === 9);
  const warriors = units.filter((u) => u.type === 2).length;
  // A native military query uses permitted records only. Unknown enemies cannot
  // become sources. Strength weights combine observed health and attack power.
  const hotspots = ctx.spatial.hotspots({
    sources: {
      units: { relation: "enemy", type: "warrior" },
      weight: "strength",
    },
    radius: 6,
    limit: 3,
  });
  ctx.telemetry.set(
    "military.visibleThreat",
    hotspots.length ? hotspots[0].score : 0,
  );
  const enemies = ctx.game
    .buildings({ limit: 256 })
    .filter(
      (b) =>
        b.team !== ctx.myTeam &&
        !(
          ctx.game.teams().find((t) => t.id === ctx.myTeam).allies &
          (1 << b.team)
        ),
    );
  const target = enemies[0] || hotspots[0];
  if (target && warriors >= 6) {
    ctx.telemetry.set("military.attacking", true);
    if (war) {
      war.x = target.x;
      war.y = target.y;
      war.workers = Math.min(20, warriors);
      war.range = 8;
    } else if (!active(ctx, attack))
      attack = ctx.actions.build({
        building: "warflag",
        region: { x: target.x, y: target.y, width: 1, height: 1 },
        workers: Math.min(20, warriors),
        range: 8,
      });
  }
  if (explorer) {
    ctx.telemetry.set("military.exploring", true);
    // Explore gradually beyond home, wrapping at the map seams. Flags themselves
    // may be placed at exact coordinates; unlike buildings they have no footprint.
    // Visit an eight-by-eight grid over the entire torus, not just nearby land.
    // Module-level direction is plain saved data, so a resumed game continues
    // its survey. The engine wraps geometry; these coordinates are explicit tiles.
    const cell = direction++ % 64;
    explorer.x =
      (home.x +
        ((cell % 8) - 3) * Math.ceil(ctx.game.map.width / 8) +
        ctx.game.map.width) %
      ctx.game.map.width;
    explorer.y =
      (home.y +
        (Math.floor(cell / 8) - 3) * Math.ceil(ctx.game.map.height / 8) +
        ctx.game.map.height) %
      ctx.game.map.height;
    explorer.workers = 2;
    explorer.range = 12;
  } else if (!active(ctx, exploration)) {
    // Exact-coordinate example. buildingTypes() returns variant IDs; do not
    // hard-code those IDs. Ordinary native validation remains authoritative.
    const type = ctx.game
      .buildingTypes()
      .find((t) => t.name === "explorationflag");
    if (type)
      exploration = ctx.actions.create({
        buildingType: type.id,
        x: home.x,
        y: home.y,
        workers: 2,
        futureWorkers: 2,
        range: 12,
      });
  }
  ctx.telemetry.set("military.warriors", warriors, { unit: "units" });
}
/** @param {import('../types/glob2-v2').ContextV2} ctx @param {number|null} id */
function active(ctx, id) {
  if (id === null) return false;
  const status = ctx.actions.status(id);
  return (
    !!status && ["pending", "issued", "constructing"].includes(status.status)
  );
}
