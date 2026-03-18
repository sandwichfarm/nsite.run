/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { StorageClient } from "./client.ts";
import type { Config } from "../types.ts";

const testConfig: Config = {
  storagePassword: "test-pass",
  storageHostname: "storage.bunnycdn.com",
  storageUsername: "test-zone",
  cdnHostname: "cdn.test",
  serverUrl: "https://blossom.test",
  maxUploadSize: 104857600,
};

Deno.test("StorageClient.put: returns true on 201 response", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 }));
    const storage = new StorageClient(testConfig);
    const result = await storage.put("test/path", new Uint8Array([1, 2, 3]));
    assertEquals(result, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.put: returns false on non-201 response", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 500 }));
    const storage = new StorageClient(testConfig);
    const result = await storage.put("test/path", new Uint8Array([1, 2, 3]));
    assertEquals(result, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.get: returns response on 200", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response("hello", { status: 200 }));
    const storage = new StorageClient(testConfig);
    const result = await storage.get("test/path");
    assertEquals(result instanceof Response, true);
    if (result) {
      const body = await result.text();
      assertEquals(body, "hello");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.get: returns null on 404", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 404 }));
    const storage = new StorageClient(testConfig);
    const result = await storage.get("test/path");
    assertEquals(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.head: returns response on 200", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(null, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );
    const storage = new StorageClient(testConfig);
    const result = await storage.head("test/path");
    assertEquals(result instanceof Response, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.head: returns null on 404", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 404 }));
    const storage = new StorageClient(testConfig);
    const result = await storage.head("test/path");
    assertEquals(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("StorageClient.blobPath: returns sharded path", () => {
  const storage = new StorageClient(testConfig);
  const sha256 = "abcdef1234567890".padEnd(64, "0");
  const path = storage.blobPath(sha256);
  assertEquals(path, `blobs/ab/${sha256}`);
});

Deno.test("StorageClient.blobUrl: returns CDN URL", () => {
  const storage = new StorageClient(testConfig);
  const sha256 = "abcdef1234567890".padEnd(64, "0");
  const url = storage.blobUrl(sha256);
  assertEquals(url.includes(testConfig.cdnHostname), true);
  assertEquals(url.includes(`/ab/${sha256}`), true);
});
