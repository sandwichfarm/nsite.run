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

// ---- Blossom paths → blossom (direct integration, not proxy) ----

Deno.test("route: GET /upload routes to blossom (404 Not Found)", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "GET" });
  const res = await route(req);
  // Blossom has no GET /upload handler — returns 404
  assertEquals(res.status, 404);
});

Deno.test("route: PUT /upload routes to blossom (401 without auth)", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "PUT" });
  const res = await route(req);
  // Blossom requires auth for upload — returns 401
  assertEquals(res.status, 401);
});

Deno.test("route: GET /list/abc123 routes to blossom (400 invalid pubkey)", async () => {
  const req = makeRequest("/list/abc123", "nsite.run");
  const res = await route(req);
  // "abc123" is not a valid 64-char hex pubkey — returns 400
  assertEquals(res.status, 400);
});

Deno.test("route: GET /mirror routes to blossom (404 Not Found)", async () => {
  const req = makeRequest("/mirror", "nsite.run");
  const res = await route(req);
  // Blossom has no GET /mirror handler — returns 404
  assertEquals(res.status, 404);
});

Deno.test("route: GET /report routes to blossom (404 Not Found)", async () => {
  const req = makeRequest("/report", "nsite.run");
  const res = await route(req);
  // Blossom has no GET /report handler — returns 404
  assertEquals(res.status, 404);
});

Deno.test("route: GET /server-info routes to blossom (200 OK)", async () => {
  const req = makeRequest("/server-info", "nsite.run");
  const res = await route(req);
  // Server info is a public endpoint — returns 200
  assertEquals(res.status, 200);
});

Deno.test("route: GET /{64 hex chars} routes to blossom (500 storage error)", async () => {
  const sha256 = "a".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run");
  const res = await route(req);
  // Storage not configured with real credentials — handler errors → 500
  assertEquals(res.status, 500);
});

Deno.test("route: HEAD /{64 hex chars} routes to blossom (500 storage error)", async () => {
  const sha256 = "b".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run", { method: "HEAD" });
  const res = await route(req);
  // Storage not configured with real credentials — handler errors → 500
  assertEquals(res.status, 500);
});

Deno.test("route: DELETE /{64 hex chars} routes to blossom (401 without auth)", async () => {
  const sha256 = "c".repeat(64);
  const req = makeRequest(`/${sha256}`, "nsite.run", { method: "DELETE" });
  const res = await route(req);
  // Blossom requires auth for delete — returns 401
  assertEquals(res.status, 401);
});

// ---- Blossom OPTIONS: CORS preflight ----

Deno.test("route: OPTIONS /upload returns 204 with CORS headers", async () => {
  const req = makeRequest("/upload", "nsite.run", { method: "OPTIONS" });
  const res = await route(req);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods"),
    "GET, HEAD, PUT, DELETE, OPTIONS",
  );
  // Blossom CORS includes additional headers beyond just Authorization and Content-Type
  const allowHeaders = res.headers.get("Access-Control-Allow-Headers") ?? "";
  assertEquals(allowHeaders.includes("Authorization"), true);
  assertEquals(allowHeaders.includes("Content-Type"), true);
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

// ---- named-site subdomain → redirect for invalid npub ----

Deno.test("route: named subdomain with invalid npub redirects to base domain", async () => {
  const req = makeRequest("/", "blog.npub1abc.nsite.run");
  const res = await route(req);
  // Invalid npub in named subdomain results in redirect to base domain
  assertEquals(res.status, 302);
});

Deno.test("route: named subdomain with hyphen and invalid npub redirects to base domain", async () => {
  const req = makeRequest("/", "my-site.npub1abc.nsite.run");
  const res = await route(req);
  // Invalid npub in named subdomain results in redirect to base domain
  assertEquals(res.status, 302);
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
