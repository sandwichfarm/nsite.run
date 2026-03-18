// Set mock env vars before module-level code in resolver/db run
Deno.env.set("BUNNY_DB_URL", "libsql://test.turso.io");
Deno.env.set("BUNNY_DB_AUTH_TOKEN", "test-token");

import { assertEquals } from "@std/assert";
import { route } from "./router.ts";

// Helper to make requests with proper Host header
function makeRequest(
  path: string,
  host: string,
  options: RequestInit = {},
): Request {
  return new Request(`https://nsite.run${path}`, {
    ...options,
    headers: {
      "Host": host,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

// ---- WebSocket upgrade → relay ----

Deno.test("route: WebSocket upgrade routes to relay (any host)", async () => {
  const req = new Request("https://nsite.run/", {
    headers: { "Upgrade": "websocket", "Host": "nsite.run" },
  });
  const res = await route(req);
  // Without RELAY_URL configured, returns 503
  assertEquals(res.status, 503);
  const body = await res.text();
  assertEquals(body, "Relay not configured");
});

Deno.test("route: WebSocket upgrade on npub host routes to relay (not resolver)", async () => {
  const req = new Request("https://nsite.run/", {
    headers: { "Upgrade": "websocket", "Host": "npub1abc.nsite.run" },
  });
  const res = await route(req);
  assertEquals(res.status, 503);
  const body = await res.text();
  assertEquals(body, "Relay not configured");
});

// ---- Blossom paths → blossom ----

Deno.test("route: GET /upload routes to blossom", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "GET" });
  const res = await route(req);
  // Without BLOSSOM_URL configured, returns 503
  assertEquals(res.status, 503);
  const body = await res.text();
  assertEquals(body, "Blossom not configured");
});

Deno.test("route: PUT /upload routes to blossom", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "PUT" });
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: GET /list/abc123 routes to blossom", async () => {
  const req = makeRequest("/list/abc123", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: GET /mirror routes to blossom", async () => {
  const req = makeRequest("/mirror", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: GET /report routes to blossom", async () => {
  const req = makeRequest("/report", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: GET /server-info routes to blossom", async () => {
  const req = makeRequest("/server-info", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: GET /{64 hex chars} routes to blossom", async () => {
  const sha256 = "a".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: HEAD /{64 hex chars} routes to blossom", async () => {
  const sha256 = "b".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run", { method: "HEAD" });
  const res = await route(req);
  assertEquals(res.status, 503);
});

Deno.test("route: DELETE /{64 hex chars} routes to blossom", async () => {
  const sha256 = "c".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run", { method: "DELETE" });
  const res = await route(req);
  assertEquals(res.status, 503);
});

// ---- Blossom OPTIONS: CORS preflight ----

Deno.test("route: OPTIONS /upload returns 200 with CORS headers", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "OPTIONS" });
  const res = await route(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET, HEAD, PUT, DELETE, OPTIONS",
  );
  assertEquals(
    res.headers.get("Access-Control-Allow-Headers"),
    "Authorization, Content-Type",
  );
});

// ---- npub subdomain → resolver ----

Deno.test("route: npub subdomain dispatches to live resolver (400 for invalid npub)", async () => {
  const req = makeRequest("/", "npub1abc.nsite.run");
  const res = await route(req);
  assertEquals(res.status, 400);
});

Deno.test("route: npub subdomain non-blossom path dispatches to live resolver", async () => {
  const req = makeRequest("/some-page", "npub1xyz.nsite.run");
  const res = await route(req);
  assertEquals(res.status, 400);
});

// ---- named-site subdomain → resolver ----

Deno.test("route: named subdomain dispatches to live resolver (400 for invalid npub)", async () => {
  const req = makeRequest("/", "blog.npub1abc.nsite.run");
  const res = await route(req);
  assertEquals(res.status, 400);
});

Deno.test("route: named subdomain with hyphen dispatches to live resolver", async () => {
  const req = makeRequest("/", "my-site.npub1abc.nsite.run");
  const res = await route(req);
  assertEquals(res.status, 400);
});

// ---- Root domain → SPA ----

Deno.test("route: root domain routes to SPA (HTML, 200)", async () => {
  // Without SPA_ASSETS_URL set, returns graceful fallback HTML
  const req = makeRequest("/", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 200);
  const contentType = res.headers.get("Content-Type") ?? "";
  assertEquals(contentType.startsWith("text/html"), true);
});

Deno.test("route: root domain with non-blossom path routes to SPA", async () => {
  // Without SPA_ASSETS_URL set, returns graceful fallback HTML
  const req = makeRequest("/some-path", "nsite.run");
  const res = await route(req);
  assertEquals(res.status, 200);
  const contentType = res.headers.get("Content-Type") ?? "";
  assertEquals(contentType.startsWith("text/html"), true);
});

Deno.test("route: unknown subdomain redirects to base domain", async () => {
  const req = makeRequest("/", "other.nsite.run");
  const res = await route(req);
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("Location"), "https://nsite.run/");
});
