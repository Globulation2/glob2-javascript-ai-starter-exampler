import { readFile } from "node:fs/promises";
const pin = JSON.parse(await readFile("engine.json", "utf8"));
for (const name of ["glob2.d.ts", "glob2-v2.d.ts"]) {
  const response = await fetch(
    `https://raw.githubusercontent.com/Globulation2/glob2/${pin.revision}/examples/javascript/${name}`,
  );
  if (!response.ok)
    throw Error(`Cannot read pinned engine declaration: ${response.status}`);
  const expected = await response.text(),
    actual = await readFile(`types/${name}`, "utf8");
  if (expected !== actual)
    throw Error(`${name} differs from the pinned engine API`);
}
console.log("Declarations match the pinned engine revision.");
