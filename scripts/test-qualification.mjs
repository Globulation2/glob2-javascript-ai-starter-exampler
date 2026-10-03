import { test } from "node:test";
import assert from "node:assert/strict";
import { compareContinuation, records } from "./qualification-trace.mjs";
function trace(ticks) {
  const bytes = Buffer.alloc(20 + ticks.length * 20);
  bytes.write("GCS1");
  [1, 1, ticks.length, 0].forEach((value, i) =>
    bytes.writeUInt32LE(value, 4 + i * 4),
  );
  ticks.forEach((tick, i) => {
    bytes.writeUInt32LE(tick, 20 + i * 20);
    bytes.writeUInt32LE(tick + 10, 28 + i * 20); // Team checksum.
  });
  return bytes;
}
test("qualification compares the entire requested continuation", () => {
  const baseline = trace([0, 1, 2, 3]);
  const interval = { firstTick: 2, count: 2 };
  assert.equal(compareContinuation(baseline, trace([2, 3]), interval), 2);
  assert.throws(
    () => compareContinuation(baseline, trace([2]), interval),
    /Expected/,
  );
  assert.throws(
    () => compareContinuation(baseline, trace([3]), interval),
    /Unexpected/,
  );
  assert.throws(
    () => compareContinuation(baseline, trace([2, 4]), interval),
    /Nonconsecutive/,
  );
  const changed = trace([2, 3]);
  changed.writeUInt32LE(99, 28);
  assert.throws(
    () => compareContinuation(baseline, changed, interval),
    /diverged/,
  );
});
test("qualification rejects malformed trace bodies and headers", () => {
  assert.throws(() => [...records(trace([0]).subarray(0, 38))], /Truncated/);
  assert.throws(
    () => [...records(Buffer.concat([trace([0]), Buffer.from([0])]))],
    /Trailing/,
  );
  const unsupported = trace([0]);
  unsupported.writeUInt32LE(1, 16);
  assert.throws(() => [...records(unsupported)], /Unsupported/);
});
