// GCS1 contains an aggregate checksum followed by detailed team/entity checksums.
// Save-header history changes the aggregate on resume; compare every detailed
// record instead, but require the whole expected interval so missing ticks fail.
export function* records(bytes) {
  let offset = 0;
  function take(size) {
    if (size > bytes.length - offset) throw Error("Truncated checksum trace");
    const start = offset;
    offset += size;
    return start;
  }
  function u32() {
    return bytes.readUInt32LE(take(4));
  }
  if (bytes.toString("ascii", take(4), 4) !== "GCS1")
    throw Error("Unknown checksum format");
  const teams = u32(),
    players = u32(),
    count = u32(),
    flags = u32();
  if (teams < 1 || teams > 32 || players < 1 || players > 32 || flags !== 0)
    throw Error("Unsupported checksum header");
  let previous = null;
  for (let n = 0; n < count; n++) {
    const tick = u32();
    if (previous !== null && tick !== previous + 1)
      throw Error("Nonconsecutive checksum ticks");
    previous = tick;
    u32(); // Aggregate checksum includes save history, intentionally excluded.
    const start = offset;
    for (let t = 0; t < teams; t++) {
      u32(); // Team checksum.
      for (let kind = 0; kind < 2; kind++) {
        const entities = u32();
        for (let e = 0; e < entities; e++) {
          take(6); // Slot (u16) and entity checksum (u32).
          take(4 * u32()); // Detailed checksum vector.
        }
      }
    }
    yield { tick, data: bytes.subarray(start, offset) };
  }
  if (offset !== bytes.length) throw Error("Trailing checksum data");
}
export function compareContinuation(baseline, resumed, { firstTick, count }) {
  // Team/player layouts must agree before interpreting payloads.
  if (!baseline.subarray(4, 12).equals(resumed.subarray(4, 12)))
    throw Error("Checksum team/player layouts differ");
  const reference = records(baseline);
  let expected = reference.next().value,
    matched = 0;
  for (const actual of records(resumed)) {
    if (actual.tick !== firstTick + matched || matched >= count)
      throw Error(`Unexpected continuation tick ${actual.tick}`);
    while (expected && expected.tick < actual.tick)
      expected = reference.next().value;
    if (
      !expected ||
      expected.tick !== actual.tick ||
      !expected.data.equals(actual.data)
    )
      throw Error(`Continuation diverged at tick ${actual.tick}`);
    matched++;
  }
  if (matched !== count)
    throw Error(`Expected ${count} continuation ticks, found ${matched}`);
  // Validate the baseline tail too, including truncation and trailing bytes.
  for (const unused of reference) {
    void unused;
  }
  return matched;
}
