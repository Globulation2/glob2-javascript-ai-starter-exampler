import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  cp,
  symlink,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await pause(50);
  }
  throw Error("Timed out waiting for the bundler");
}
test("watch publishes complete bundles and keeps the previous file on errors", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "glob2-ai-bundle-"));
  let child;
  try {
    await cp("src", join(cwd, "src"), { recursive: true });
    await cp("scripts", join(cwd, "scripts"), { recursive: true });
    await symlink(
      resolve("node_modules"),
      join(cwd, "node_modules"),
      "junction",
    );
    child = spawn(process.execPath, ["scripts/build.mjs", "--watch"], {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (data) => {
      log += data;
    });
    child.stderr.on("data", (data) => {
      log += data;
    });
    const bundle = join(cwd, "dist/example.js");
    const read = () => readFile(bundle, "utf8").catch(() => null);
    await until(async () => !!(await read()));
    const original = await read();
    assert.match(original, /apiVersion: 2/);
    const source = join(cwd, "src/index.js"),
      text = await readFile(source, "utf8");
    await writeFile(source, "export function metadata( {");
    await until(async () => log.includes("ERROR"));
    assert.equal(await read(), original);
    await writeFile(
      source,
      text.replace("Readable Colony", "Watch Rebuild Colony"),
    );
    await until(async () => (await read())?.includes("Watch Rebuild Colony"));
    assert.match(await read(), /export \{/);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await rm(cwd, { recursive: true, force: true });
  }
});

test("bundles reject runtime imports without replacing the last valid file", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "glob2-ai-import-"));
  async function build() {
    const child = spawn(process.execPath, ["scripts/build.mjs"], {
      cwd,
      stdio: "ignore",
    });
    return new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", resolve);
    });
  }
  try {
    await cp("src", join(cwd, "src"), { recursive: true });
    await cp("scripts", join(cwd, "scripts"), { recursive: true });
    await symlink(
      resolve("node_modules"),
      join(cwd, "node_modules"),
      "junction",
    );
    assert.equal(await build(), 0);
    const bundle = join(cwd, "dist/example.js"),
      original = await readFile(bundle, "utf8");
    for (const source of [
      "export async function step(ctx) { return import(ctx.moduleName); }",
      'export async function step() { return import("https://example.com/ai.js"); }',
    ]) {
      await writeFile(join(cwd, "src/index.js"), source);
      assert.notEqual(await build(), 0);
      assert.equal(await readFile(bundle, "utf8"), original);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
