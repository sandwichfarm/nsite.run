import { BUNDLE_SIZE_LIMIT, BUNDLE_SIZE_WARN } from "@nsite/shared/constants";

const bundles = [
  { name: "relay", path: "apps/relay/dist/relay.bundle.js" },
  { name: "blossom", path: "apps/blossom/dist/blossom.bundle.js" },
  { name: "gateway", path: "apps/gateway/dist/gateway.bundle.js" },
];

let failed = false;
const summary: Record<string, { size: number; status: "ok" | "warn" | "fail" }> = {};

for (const bundle of bundles) {
  let size: number;
  try {
    const stat = await Deno.stat(bundle.path);
    size = stat.size;
  } catch {
    const msg = `FAIL: ${bundle.name} bundle not found (did you run deno task build?)`;
    console.error(msg);
    summary[bundle.name] = { size: 0, status: "fail" };
    failed = true;
    continue;
  }

  const kb = (size / 1024).toFixed(1);

  if (size > BUNDLE_SIZE_LIMIT) {
    console.error(`FAIL: ${bundle.name} is ${kb}KB -- exceeds 1MB hard limit`);
    summary[bundle.name] = { size, status: "fail" };
    failed = true;
  } else if (size > BUNDLE_SIZE_WARN) {
    console.error(`WARN: ${bundle.name} is ${kb}KB -- approaching 1MB limit (warn at 750KB)`);
    summary[bundle.name] = { size, status: "warn" };
  } else {
    console.log(`OK: ${bundle.name} is ${kb}KB`);
    summary[bundle.name] = { size, status: "ok" };
  }
}

console.log(JSON.stringify(summary));

if (failed) Deno.exit(1);
