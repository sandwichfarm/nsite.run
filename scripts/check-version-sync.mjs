#!/usr/bin/env node
// check-version-sync.mjs — assert package.json.version === jsr.json.version,
// and (when $GITHUB_REF is set to a stealthis-v* tag) assert both equal the tag.
//
// Invocation:
//   Local: `node scripts/check-version-sync.mjs`
//          (or `pnpm --filter @nsite/stealthis run check-version-sync`)
//   CI:    same, run as a pre-publish step in publish-stealthis.yml (Phase 28, CI-02).
//
// Exits 0 on sync, 1 on drift. No third-party deps; node:fs + node:url + node:process only.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "packages", "stealthis", "package.json");
const jsrPath = join(here, "..", "packages", "stealthis", "jsr.json");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`check-version-sync: failed to read/parse ${path}: ${err.message}`);
    process.exit(1);
  }
}

const pkg = readJson(pkgPath);
const jsr = readJson(jsrPath);

if (typeof pkg.version !== "string" || typeof jsr.version !== "string") {
  console.error(
    `check-version-sync: missing .version field (pkg=${pkg.version}, jsr=${jsr.version})`,
  );
  process.exit(1);
}

if (pkg.version !== jsr.version) {
  console.error(
    `check-version-sync: DRIFT — package.json=${pkg.version}, jsr.json=${jsr.version}`,
  );
  process.exit(1);
}

const ref = process.env.GITHUB_REF;
if (ref) {
  const match = ref.match(/^refs\/tags\/stealthis-v(.+)$/);
  if (!match) {
    console.error(
      `check-version-sync: GITHUB_REF=${ref} is not a stealthis-v* tag ref`,
    );
    process.exit(1);
  }
  const tagVersion = match[1];
  if (tagVersion !== pkg.version) {
    console.error(
      `check-version-sync: TAG DRIFT — tag=${tagVersion}, package.json=${pkg.version}, jsr.json=${jsr.version}`,
    );
    process.exit(1);
  }
}

console.log(`OK: ${pkg.version}`);
process.exit(0);
