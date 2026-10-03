import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.env.GLOB2_BIN || "glob2",
  ["--check-ai", "dist/example.js"],
  { stdio: "inherit" },
);
if (result.error)
  console.error(
    "Set GLOB2_BIN to a Glob2 build supporting API profile 2.",
    result.error.message,
  );
process.exit(result.status ?? 1);
