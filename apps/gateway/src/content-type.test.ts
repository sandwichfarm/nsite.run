import { assertEquals } from "@std/assert";
import { detectCompression, detectContentType, resolveIndexPath } from "./content-type.ts";

Deno.test("detectContentType - .html returns text/html with charset", () => {
  assertEquals(detectContentType(".html"), "text/html; charset=utf-8");
});

Deno.test("detectContentType - .css returns text/css", () => {
  assertEquals(detectContentType(".css"), "text/css");
});

Deno.test("detectContentType - .js returns application/javascript", () => {
  assertEquals(detectContentType(".js"), "application/javascript");
});

Deno.test("detectContentType - .png returns image/png", () => {
  assertEquals(detectContentType(".png"), "image/png");
});

Deno.test("detectContentType - .woff2 returns font/woff2", () => {
  assertEquals(detectContentType(".woff2"), "font/woff2");
});

Deno.test("detectContentType - .wasm returns application/wasm", () => {
  assertEquals(detectContentType(".wasm"), "application/wasm");
});

Deno.test("detectContentType - unknown extension returns application/octet-stream", () => {
  assertEquals(detectContentType(".unknown"), "application/octet-stream");
});

Deno.test("detectContentType - empty string returns application/octet-stream", () => {
  assertEquals(detectContentType(""), "application/octet-stream");
});

Deno.test("detectContentType - full path extracts extension correctly", () => {
  assertEquals(detectContentType("/path/to/file.html"), "text/html; charset=utf-8");
  assertEquals(detectContentType("/style.css"), "text/css");
  assertEquals(detectContentType("/app.js"), "application/javascript");
});

Deno.test("detectContentType - .json returns application/json", () => {
  assertEquals(detectContentType(".json"), "application/json");
});

Deno.test("detectContentType - .svg returns image/svg+xml", () => {
  assertEquals(detectContentType(".svg"), "image/svg+xml");
});

Deno.test("detectContentType - .ico returns image/x-icon", () => {
  assertEquals(detectContentType(".ico"), "image/x-icon");
});

Deno.test("detectContentType - .mjs returns application/javascript", () => {
  assertEquals(detectContentType(".mjs"), "application/javascript");
});

Deno.test("resolveIndexPath - / returns /index.html", () => {
  assertEquals(resolveIndexPath("/"), "/index.html");
});

Deno.test("resolveIndexPath - /about/ returns /about/index.html", () => {
  assertEquals(resolveIndexPath("/about/"), "/about/index.html");
});

Deno.test("resolveIndexPath - /page.html unchanged", () => {
  assertEquals(resolveIndexPath("/page.html"), "/page.html");
});

Deno.test("resolveIndexPath - /style.css unchanged", () => {
  assertEquals(resolveIndexPath("/style.css"), "/style.css");
});

Deno.test("resolveIndexPath - /nested/path/ returns /nested/path/index.html", () => {
  assertEquals(resolveIndexPath("/nested/path/"), "/nested/path/index.html");
});

Deno.test("detectCompression - .br returns br encoding and base path", () => {
  const result = detectCompression("/style.css.br");
  assertEquals(result, { encoding: "br", basePath: "/style.css" });
});

Deno.test("detectCompression - .gz returns gzip encoding and base path", () => {
  const result = detectCompression("/app.js.gz");
  assertEquals(result, { encoding: "gzip", basePath: "/app.js" });
});

Deno.test("detectCompression - no compression returns null", () => {
  assertEquals(detectCompression("/index.html"), null);
});

Deno.test("detectCompression - no extension returns null", () => {
  assertEquals(detectCompression("/no-extension"), null);
});

Deno.test("detectCompression - .br on nested path", () => {
  const result = detectCompression("/assets/bundle.js.br");
  assertEquals(result, { encoding: "br", basePath: "/assets/bundle.js" });
});
