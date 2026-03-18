import { assert, assertEquals } from "@std/assert";
import { securityHeaders } from "./security-headers.ts";

Deno.test("securityHeaders - returns X-Content-Type-Options: nosniff", () => {
  assertEquals(securityHeaders()["X-Content-Type-Options"], "nosniff");
});

Deno.test("securityHeaders - returns X-Frame-Options: SAMEORIGIN", () => {
  assertEquals(securityHeaders()["X-Frame-Options"], "SAMEORIGIN");
});

Deno.test("securityHeaders - returns Strict-Transport-Security with max-age", () => {
  assert(securityHeaders()["Strict-Transport-Security"].includes("max-age="));
});

Deno.test("securityHeaders - Strict-Transport-Security includes includeSubDomains", () => {
  assert(securityHeaders()["Strict-Transport-Security"].includes("includeSubDomains"));
});

Deno.test("securityHeaders - returns Referrer-Policy", () => {
  assertEquals(securityHeaders()["Referrer-Policy"], "strict-origin-when-cross-origin");
});

Deno.test("securityHeaders - returns Content-Security-Policy", () => {
  const csp = securityHeaders()["Content-Security-Policy"];
  assert(csp !== undefined && csp.length > 0);
});

Deno.test("securityHeaders - CSP includes unsafe-inline for scripts", () => {
  const csp = securityHeaders()["Content-Security-Policy"];
  assert(csp.includes("unsafe-inline"));
});

Deno.test("securityHeaders - has all 5 required headers", () => {
  const headers = securityHeaders();
  const keys = Object.keys(headers);
  assertEquals(keys.length >= 5, true);
  assert(keys.includes("X-Content-Type-Options"));
  assert(keys.includes("X-Frame-Options"));
  assert(keys.includes("Strict-Transport-Security"));
  assert(keys.includes("Referrer-Policy"));
  assert(keys.includes("Content-Security-Policy"));
});
