let pending = null;
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
  if (pending !== null) {
    const status = ctx.actions.status(pending);
    if (status && ["pending", "issued", "constructing"].includes(status.status))
      return;
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
          [0, 1, 3, 5].includes(b.shortType),
      ));
  if (candidate) {
    pending = ctx.actions.upgrade({
      building: candidate.ref,
      workers: 3,
      futureWorkers: 2,
    });
    ctx.telemetry.set("technology.upgradeFamily", candidate.shortType);
  }
}
