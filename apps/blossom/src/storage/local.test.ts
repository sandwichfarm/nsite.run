import { assertEquals, assertNotEquals } from "@std/assert";
import { LocalStorageClient } from "./local.ts";

let tempDir: string;
let client: LocalStorageClient;
const SERVER_URL = "http://localhost:8082";

// Set up temp dir for test isolation
const tempSetup = await Deno.makeTempDir({ prefix: "blossom-local-test-" });
tempDir = tempSetup;
client = new LocalStorageClient(tempDir, SERVER_URL);

// Cleanup after all tests
addEventListener("unload", async () => {
  await Deno.remove(tempDir, { recursive: true }).catch(() => {});
});

Deno.test("LocalStorageClient - put and get round-trip bytes", async () => {
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  const ok = await client.put("blobs/ab/abc123", data);
  assertEquals(ok, true);

  const resp = await client.get("blobs/ab/abc123");
  assertNotEquals(resp, null);
  const bytes = new Uint8Array(await resp!.arrayBuffer());
  assertEquals(bytes, data);
});

Deno.test("LocalStorageClient - get nonexistent path returns null", async () => {
  const resp = await client.get("nonexistent/path/doesnotexist");
  assertEquals(resp, null);
});

Deno.test("LocalStorageClient - head returns 200 after put", async () => {
  const data = new Uint8Array([10, 20, 30]);
  await client.put("blobs/he/head-test", data);

  const resp = await client.head("blobs/he/head-test");
  assertNotEquals(resp, null);
  assertEquals(resp!.status, 200);
});

Deno.test("LocalStorageClient - head nonexistent path returns null", async () => {
  const resp = await client.head("nonexistent/head/path");
  assertEquals(resp, null);
});

Deno.test("LocalStorageClient - delete removes file and returns true", async () => {
  const data = new Uint8Array([7, 8, 9]);
  await client.put("blobs/de/delete-me", data);

  const deleted = await client.delete("blobs/de/delete-me");
  assertEquals(deleted, true);

  // File should be gone
  const resp = await client.get("blobs/de/delete-me");
  assertEquals(resp, null);
});

Deno.test("LocalStorageClient - delete nonexistent returns false", async () => {
  const result = await client.delete("nonexistent/delete/path");
  assertEquals(result, false);
});

Deno.test("LocalStorageClient - putJson and getJson round-trip", async () => {
  const data = { foo: "bar", count: 42, nested: { x: true } };
  const ok = await client.putJson("meta/test.json", data);
  assertEquals(ok, true);

  const retrieved = await client.getJson<typeof data>("meta/test.json");
  assertEquals(retrieved, data);
});

Deno.test("LocalStorageClient - getText returns file content", async () => {
  const content = "hello world text content";
  await client.put("texts/hello.txt", new TextEncoder().encode(content));

  const text = await client.getText("texts/hello.txt");
  assertEquals(text, content);
});

Deno.test("LocalStorageClient - list returns relative paths for prefix", async () => {
  // Write multiple files directly under same prefix (not nested subdirectories)
  await client.put("listtest/ab/file1.json", new TextEncoder().encode("{}"));
  await client.put("listtest/ab/file2.json", new TextEncoder().encode("{}"));

  const items = await client.list("listtest/ab/");
  // Should contain at least two entries
  assertEquals(items.length >= 2, true);
  // Items should be relative paths starting with the prefix
  for (const item of items) {
    assertEquals(item.startsWith("listtest/ab/"), true);
  }
});

Deno.test("LocalStorageClient - list empty directory returns empty array", async () => {
  const items = await client.list("empty-dir-that-does-not-exist/");
  assertEquals(items, []);
});

Deno.test("LocalStorageClient - blobUrl returns http://localhost:8082 URL", () => {
  const sha256 = "abc123def456789012345678901234567890123456789012345678901234567890";
  const url = client.blobUrl(sha256);
  assertEquals(url, `http://localhost:8082/blobs/${sha256.substring(0, 2)}/${sha256}`);
});

Deno.test("LocalStorageClient - blobPath returns correct path", () => {
  const sha256 = "abc123def456789012345678901234567890123456789012345678901234567890";
  const path = client.blobPath(sha256);
  assertEquals(path, `blobs/${sha256.substring(0, 2)}/${sha256}`);
});

Deno.test("LocalStorageClient - metaPath returns correct path", () => {
  const sha256 = "abc123def456789012345678901234567890123456789012345678901234567890";
  const path = client.metaPath(sha256);
  assertEquals(path, `meta/${sha256.substring(0, 2)}/${sha256}.json`);
});

Deno.test("LocalStorageClient - listPath returns correct path", () => {
  const pubkey = "pubkey123abc456def789012345678901234567890123456789012345678901234";
  const path = client.listPath(pubkey);
  assertEquals(path, `lists/${pubkey.substring(0, 2)}/${pubkey}/index.json`);
});

Deno.test("LocalStorageClient - reportPath returns correct path", () => {
  const sha256 = "abc123def456789012345678901234567890123456789012345678901234567890";
  const path = client.reportPath(sha256);
  assertEquals(path, `reports/${sha256}.json`);
});

Deno.test("LocalStorageClient - cdnHostname is set from serverUrl", () => {
  assertEquals(client.cdnHostname, "localhost:8082");
});
