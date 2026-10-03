// Run the actual bundled program, retaining reviewable saves, replays and logs.
// This is intentionally opt-in: it needs a compatible native Glob2 executable.
import { spawnSync } from "node:child_process";
import { mkdirSync, openSync, closeSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const binary = process.env.GLOB2_BIN;
if (!binary) throw Error("Set GLOB2_BIN to a profile-2 Glob2 executable.");
const output = resolve(
  process.env.GLOB2_EVIDENCE || `artifacts/qualification-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
const bundle = resolve("dist/example.js");
function run(name, args) {
  const dir = resolve(output, name),
    log = resolve(output, `${name}.log`);
  const fd = openSync(log, "w");
  const result = spawnSync(
    binary,
    ["--run-game", ...args, "--output-dir", dir],
    {
      env: {
        ...process.env,
        GLOB2_USER_DATA_DIR: resolve(output, `profile-${name}`),
      },
      stdio: ["ignore", fd, fd],
    },
  );
  closeSync(fd);
  if (result.error || result.status !== 0)
    throw Error(`${name} failed; inspect ${log}`, { cause: result.error });
  console.log(`Finished ${name}: ${dir}`);
  return dir;
}
const baseline = run("match", [
  "--generator",
  "15",
  "--map-seed",
  "91",
  "--game-seed",
  "19",
  "--param",
  "teams=2",
  "--param",
  "width=7",
  "--param",
  "height=7",
  "--param",
  "workers=8",
  "--player",
  "javascript",
  "--ai-script",
  `0:${bundle}`,
  "--player",
  "javascript",
  "--ai-script",
  `1:${bundle}`,
  "--ticks",
  "65536",
  "--compute-threads",
  "1",
  "--save",
  "initial",
  "--save",
  "every:8192",
  "--save",
  "final",
  "--replay",
  "true",
  "--telemetry",
  "checksums",
  "--telemetry",
  "team-timeline",
]);
const log = readFileSync(resolve(output, "match.log"), "utf8");
function values(name) {
  return [
    ...log.matchAll(/GLOB2_AI_VALUE[^\n]*field="([^"]+)" value="([^"]*)"/g),
  ]
    .filter((m) => m[1] === name)
    .map((m) => m[2]);
}
function requireCoverage(name, predicate) {
  if (!values(name).some(predicate))
    throw Error(`Missing scenario coverage: ${name}; inspect ${output}`);
}
if (values("runtime.status").includes("Disabled"))
  throw Error("A controller failed during the match");
requireCoverage("colony.population", (v) => Number(v) > 8);
requireCoverage("construction.lastResult", (v) => v === "completed");
requireCoverage("technology.trainedWorkers", (v) => Number(v) > 0);
requireCoverage("technology.upgradedBuildings", (v) => Number(v) > 0);
requireCoverage("military.attacking", (v) => v === "true");
requireCoverage("military.exploring", (v) => v === "true");
requireCoverage("colony.guardZone", (v) => v === "true");
// GCS1 is the engine's detailed per-tick team/entity trace. Aggregate checksums
// include save-header history, so continuation compares all detailed records.
function* records(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "GCS1")
    throw Error("Unknown checksum format");
  const teams = bytes.readUInt32LE(4),
    count = bytes.readUInt32LE(12);
  let offset = 20;
  for (let n = 0; n < count; n++) {
    const tick = bytes.readUInt32LE(offset);
    offset += 8;
    const start = offset;
    for (let t = 0; t < teams; t++) {
      offset += 4;
      for (let kind = 0; kind < 2; kind++) {
        const entities = bytes.readUInt32LE(offset);
        offset += 4;
        for (let e = 0; e < entities; e++)
          offset += 10 + 4 * bytes.readUInt32LE(offset + 6);
      }
    }
    yield { tick, data: bytes.subarray(start, offset) };
  }
  if (offset !== bytes.length) throw Error("Malformed checksum trace");
}
for (const workers of [1, 4]) {
  const resumed = run(`resume-${workers}`, [
    "--load-game",
    resolve(baseline, "checkpoint-8192.game.gz"),
    "--ticks",
    "16384",
    "--compute-threads",
    String(workers),
    "--save",
    "final",
    "--replay",
    "true",
    "--telemetry",
    "checksums",
  ]);
  const reference = records(
    readFileSync(resolve(baseline, "game.replay.checksums")),
  );
  let expected = reference.next().value,
    count = 0;
  for (const actual of records(
    readFileSync(resolve(resumed, "game.replay.checksums")),
  )) {
    while (expected && expected.tick < actual.tick)
      expected = reference.next().value;
    if (
      !expected ||
      expected.tick !== actual.tick ||
      !expected.data.equals(actual.data)
    )
      throw Error(
        `Continuation diverged at tick ${actual.tick} with ${workers} workers`,
      );
    count++;
  }
  if (!count) throw Error("Empty continuation trace");
  console.log(`${count} continuation records match with ${workers} workers.`);
}
console.log(
  `All example lifecycle and continuation checks passed. Evidence: ${output}`,
);
