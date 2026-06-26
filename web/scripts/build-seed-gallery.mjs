#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readFlag(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const apiDir = resolve(rootDir, readFlag("api-dir", process.env.HAPPYIMAGE_API_DIR || "../api"));
const sourceDir = resolve(rootDir, readFlag("source-dir", process.env.HAPPYIMAGE_GALLERY_SOURCE_DIR || "../data/gallery-source"));
const outputDir = resolve(rootDir, readFlag("output", process.env.HAPPYIMAGE_GALLERY_OUTPUT_DIR || "public/seed-gallery"));
const widths = readFlag("widths", process.env.HAPPYIMAGE_GALLERY_THUMBNAIL_WIDTHS || "640");
const seedDir = resolve(sourceDir, "image-gallery-seed");
const candidateDir = resolve(sourceDir, "image-gallery-candidates");
const jsonOnly = hasFlag("json-only");
const skipThumbnails = hasFlag("skip-thumbnails") || jsonOnly;
const clean = !hasFlag("no-clean");

console.log("Building HappyImage official gallery static package");
console.log(`- api dir:       ${apiDir}`);
console.log(`- source dir:    ${sourceDir}`);
console.log(`- output dir:    ${outputDir}`);
console.log(`- widths:        ${widths}`);
console.log(`- copy assets:   ${jsonOnly ? "no" : "yes"}`);

if (clean) {
  for (const child of ["static", "images", "thumbnails"]) {
    rmSync(resolve(outputDir, child), { force: true, recursive: true });
  }
}

if (!skipThumbnails) {
  run(
    "uv",
    [
      "run",
      "python",
      "scripts/pregenerate_seed_gallery_thumbnails.py",
      "--seed-dir",
      seedDir,
      "--candidate-dir",
      candidateDir,
      "--widths",
      widths,
      "--quiet",
    ],
    apiDir,
  );
}

const exportArgs = [
  "run",
  "python",
  "scripts/export_seed_gallery_static.py",
  "--seed-dir",
  seedDir,
  "--candidate-dir",
  candidateDir,
  "--output",
  outputDir,
];
if (!jsonOnly) {
  exportArgs.push("--copy-assets");
}
run("uv", exportArgs, apiDir);

console.log("Official gallery static package is ready.");
