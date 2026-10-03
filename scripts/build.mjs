import * as esbuild from "esbuild";
import { mkdir, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
// esbuild never writes the linked path itself. A completed build is published
// with a same-directory rename so Glob2 reads either old or new complete bytes.
const atomic = {
  name: "atomic-publish",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      await mkdir("dist", { recursive: true });
      const temporary = `dist/.example-${randomUUID()}.js`;
      try {
        await writeFile(temporary, result.outputFiles[0].contents);
        await rename(temporary, "dist/example.js");
      } finally {
        await rm(temporary, { force: true });
      }
      console.log("Published dist/example.js");
    });
  },
};
const options = {
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  write: false,
  minify: false,
  splitting: false,
  external: [],
  outfile: "dist/example.js",
  plugins: [atomic],
};
if (process.argv.includes("--watch")) {
  const context = await esbuild.context(options);
  await context.watch();
} else await esbuild.build(options);
