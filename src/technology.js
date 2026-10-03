let pending = null,
  clearing = null;
/** @param {import('../types/glob2-v2').ContextV2} ctx
 * @param {import('../types/glob2-v2').ManagedBuilding[]} buildings */
export function technology(ctx, buildings) {
  const workers = ctx.game
    .units({ team: ctx.myTeam, limit: 512 })
    .filter((u) => u.type === 0);
  /** @param {number} level */
  const trainedFor = (level) =>
    workers.filter((u) => u.levels[6] > level).length >= 5;
  ctx.telemetry.set(
    "technology.trainedWorkers",
    workers.filter((u) => u.levels[6] > 0).length,
  );
  ctx.telemetry.set(
    "technology.upgradedBuildings",
    buildings.filter((b) => !b.construction && b.level > 0).length,
  );
  const clearFlag = buildings.find((b) => b.shortType === 10);
  if (pending !== null) {
    const status = ctx.actions.status(pending);
    ctx.telemetry.set(
      "technology.actionStatus",
      status ? status.status : "expired",
    );
    if (status && status.reason)
      ctx.telemetry.set("technology.actionReason", status.reason);
    if (
      status &&
      ["pending", "issued", "constructing"].includes(status.status)
    ) {
      if (clearFlag && status.status === "constructing") clearFlag.workers = 0;
      return;
    }
    pending = null;
  }
  const damaged = buildings.find(
    (b) => !b.virtual && !b.construction && b.hp < b.maxHp * 0.7,
  );
  if (damaged) {
    pending = ctx.actions.repair({
      building: damaged.ref,
      workers: 3,
      futureWorkers: 2,
    });
    return;
  }
  const schools = buildings.filter((b) => b.shortType === 6 && !b.construction);
  // School/training upgrades unlock stronger workers and warriors. Native orders
  // enforce prerequisites; a rejected upgrade becomes a failed action, not a crash.
  const candidate =
    schools.find((b) => b.level < 2 && trainedFor(b.level)) ||
    (schools.length &&
      buildings.find(
        (b) =>
          !b.virtual &&
          !b.construction &&
          b.level < 2 &&
          trainedFor(b.level) &&
          [1, 3, 4, 5].includes(b.shortType),
      ));
  if (candidate) {
    // Wheat and trees can grow back into space reserved at placement time.
    // A clearing flag maintains the upgrade area; ordinary rejected upgrade
    // orders are retried while the workers clear it. Stone cannot be cleared.
    const variant = ctx.game
      .buildingTypes()
      .find((t) => t.id === candidate.type);
    const x =
      (candidate.x + Math.floor(variant.width / 2)) % ctx.game.map.width;
    const y =
      (candidate.y + Math.floor(variant.height / 2)) % ctx.game.map.height;
    if (clearFlag) {
      clearFlag.x = x;
      clearFlag.y = y;
      clearFlag.range = 4;
      clearFlag.workers = 3;
      clearFlag.clearingResources = [true, true, true, false, true];
    } else if (
      clearing === null ||
      !["pending", "issued"].includes(
        ctx.actions.status(clearing)?.status || "",
      )
    ) {
      clearing = ctx.actions.build({
        building: "clearingflag",
        region: { x, y, width: 1, height: 1 },
        workers: 3,
        range: 4,
      });
    }
    pending = ctx.actions.upgrade({
      building: candidate.ref,
      workers: 3,
      futureWorkers: 2,
    });
    ctx.telemetry.set("technology.upgradeFamily", candidate.shortType);
  }
}
