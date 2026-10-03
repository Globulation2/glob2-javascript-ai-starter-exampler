import { economy } from "./economy.js";
import { technology } from "./technology.js";
import { military } from "./military.js";
// Only plain data persists. The engine saves these module variables automatically.
let nextDecision = 0;
let decisions = 0;
export function metadata() {
  return {
    apiVersion: 2,
    name: "Readable Colony",
    description:
      "A commented, complete starter AI: food, technology, exploration and attacks.",
    version: "1.0.0",
    author: "Globulation2",
  };
}
/** @param {import('../types/glob2-v2').ContextV2} ctx */
export function step(ctx) {
  if (ctx.tick < nextDecision) return;
  nextDecision = ctx.tick + 128;
  decisions++;
  // Handles must stay inside this callback. Modules store refs/action IDs instead.
  const buildings = ctx.game.buildings({ team: ctx.myTeam, limit: 128 });
  const units = ctx.game.units({ team: ctx.myTeam, limit: 512 });
  const home =
    buildings.find((b) => b.shortType === 0 && !b.construction) ||
    buildings.find((b) => !b.virtual);
  if (!home) return;
  economy(ctx, buildings, units, home, decisions % 4 === 1);
  // Stagger expensive choices; tick-based scheduling is independent of rendering.
  if (decisions % 4 === 0) technology(ctx, buildings);
  if (decisions % 4 === 2) military(ctx, buildings, units, home);
  ctx.telemetry.set(
    "strategy.phase",
    units.length < 30 ? "establishment" : "expansion",
  );
  ctx.telemetry.set("strategy.decisions", decisions);
  ctx.telemetry.set("colony.population", units.length, {
    unit: "units",
    description: "Own units in the bounded scan",
  });
}
