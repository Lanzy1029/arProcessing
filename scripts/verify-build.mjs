import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "dist/index.html",
  "dist/og.png",
  "dist/models/face_landmarker.task",
  "dist/wasm/vision_wasm_internal.wasm",
  "dist/wasm/vision_wasm_nosimd_internal.wasm",
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  await access(fullPath, constants.R_OK);
  const details = await stat(fullPath);
  if (details.size === 0) throw new Error(`${relativePath} is empty.`);
}

const html = await readFile(path.join(root, "dist/index.html"), "utf8");
if (!html.includes("Particle Veil")) throw new Error("Production page metadata is missing.");
if (!html.includes("./assets/")) throw new Error("Build does not use GitHub Pages-safe relative assets.");

console.log("Build verification passed: app, model, and local WASM assets are present.");
