#!/usr/bin/env node
/**
 * Upload seed-gallery to Cloudflare R2 using @aws-sdk/client-s3.
 * Uses the S3-compatible API with proper SigV4 signing.
 *
 * Usage:
 *   source .env && node scripts/upload-r2-s3.mjs
 *
 * Required env vars (in .env):
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_ACCOUNT_ID
 */

import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_DIR = join(__dirname, "..");
const SEED_GALLERY_DIR = join(PROJECT_DIR, "public", "seed-gallery");

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID || "cf0ed37d49b5ddad4614caa0aa4edb26";
const BUCKET_NAME = "happyimage-seed-gallery";
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const CONCURRENCY = 20;

const MIME_MAP = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

// --- R2 S3 Client ---
const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function uploadOne(filePath, key, size) {
  const body = await readFile(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: mimeType(filePath),
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { key, size, ok: true };
}

// --- File scanner ---
async function listFiles(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFiles(fullPath)));
    } else if (entry.name !== "README.md") {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Pool runner ---
function runPool(tasks, concurrency) {
  return new Promise((resolve) => {
    const results = [];
    let running = 0;
    let index = 0;
    let completed = 0;
    let failed = 0;
    const total = tasks.length;

    function next() {
      while (running < concurrency && index < total) {
        const i = index++;
        running++;
        tasks[i]()
          .then((r) => {
            results[i] = r;
            completed++;
            failed += r.ok ? 0 : 1;
          })
          .catch((err) => {
            results[i] = { error: err.message };
            completed++;
            failed++;
          })
          .finally(() => {
            running--;
            if (completed === total) {
              resolve({ results, failed });
            }
            next();
          });
      }
    }
    next();
  });
}

// --- Progress reporter ---
function startProgress(getState) {
  const startTime = Date.now();
  const total = getState().total;
  const interval = setInterval(() => {
    const { completed, failed } = getState();
    const elapsed = (Date.now() - startTime) / 1000;
    const pct = ((completed / total) * 100).toFixed(1);
    const rate = completed / Math.max(elapsed, 0.1);
    const remaining = total - completed;
    const eta = remaining / Math.max(rate, 0.01);
    process.stdout.write(
      `\r  ⬆ ${completed}/${total} (${pct}%) — ${rate.toFixed(0)} files/s — ETA ${eta.toFixed(0)}s — ${failed} failed   `,
    );
    if (completed >= total) {
      clearInterval(interval);
      process.stdout.write("\n");
    }
  }, 500);
  return interval;
}

// --- Main ---
async function main() {
  if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error(
      "❌ Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.\n" +
        "   Run: source .env && node scripts/upload-r2-s3.mjs",
    );
    process.exit(1);
  }

  console.log("🔍 Scanning seed-gallery files...");
  const files = await listFiles(SEED_GALLERY_DIR);

  let totalSize = 0;
  const uploadTasks = [];
  for (const filePath of files) {
    const fileStat = await stat(filePath);
    totalSize += fileStat.size;
    const relPath = relative(SEED_GALLERY_DIR, filePath);
    const key = `seed-gallery/${relPath}`;
    uploadTasks.push({ filePath, key, size: fileStat.size });
  }

  const total = uploadTasks.length;
  console.log(`  ${total} files, ${(totalSize / 1e9).toFixed(2)} GB total`);
  console.log(`  Endpoint: ${R2_ENDPOINT}`);
  console.log(`  Bucket:   ${BUCKET_NAME}\n`);

  let completed = 0;
  let failed = 0;
  const state = () => ({ completed, failed, total });
  const progressInterval = startProgress(state);

  const { failed: finalFailed } = await runPool(
    uploadTasks.map(
      ({ filePath, key, size }) =>
        () =>
          uploadOne(filePath, key, size)
            .then((r) => {
              completed++;
              return r;
            })
            .catch((err) => {
              failed++;
              completed++;
              console.error(`\n  ❌ FAIL: ${key} — ${err.message}`);
              return { error: err.message };
            }),
    ),
    CONCURRENCY,
  );

  clearInterval(progressInterval);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  if (finalFailed === 0) {
    console.log(`\n✅ All ${total} files uploaded in ${elapsed}s`);
  } else {
    console.log(
      `\n⚠️  ${total - finalFailed}/${total} uploaded (${finalFailed} failed) in ${elapsed}s`,
    );
  }
}

// Track startTime here for progress reporter
const startTime = Date.now();
main().catch((err) => {
  console.error("❌ Upload failed:", err.message);
  process.exit(1);
});
