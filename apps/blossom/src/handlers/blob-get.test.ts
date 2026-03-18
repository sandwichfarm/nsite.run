/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { handleBlobGet } from "./blob-get.ts";
import type { StorageClient } from "../storage/client.ts";
import type { Config } from "../types.ts";

const testSha256 = "a".repeat(64);

const testConfig: Config = {
  storagePassword: "test-pass",
  storageHostname: "storage.bunnycdn.com",
  storageUsername: "test-zone",
  cdnHostname: "cdn.test",
  serverUrl: "https://blossom.test",
  maxUploadSize: 104857600,
};

function makeStorage(
  overrides: Partial<Record<keyof StorageClient, unknown>> = {},
): StorageClient {
  return {
    get: async (_path: string) => null,
    head: async (_path: string) => null,
    put: async (_path: string, _body: BodyInit) => true,
    delete: async (_path: string) => true,
    getJson: async (_path: string) => null,
    putJson: async (_path: string, _data: unknown) => true,
    getToml: async (_path: string) => null,
    blobPath: (sha256: string) => `blobs/${sha256.substring(0, 2)}/${sha256}`,
    blobUrl: (sha256: string) => `https://cdn.test/blobs/${sha256.substring(0, 2)}/${sha256}`,
    metaPath: (sha256: string) => `meta/${sha256.substring(0, 2)}/${sha256}.json`,
    listPath: (pubkey: string) => `lists/${pubkey.substring(0, 2)}/${pubkey}/index.json`,
    reportPath: (sha256: string) => `reports/${sha256}.json`,
    ...overrides,
  } as unknown as StorageClient;
}

Deno.test("blob-get: returns 404 for missing blob", async () => {
  const storage = makeStorage({
    head: async (_path: string) => null,
    get: async (_path: string) => null,
  });
  const req = new Request(`https://blossom.test/${testSha256}`);
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 404);
});

Deno.test("blob-get: returns blob content for existing blob", async () => {
  const storage = makeStorage({
    head: async (_path: string) =>
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    get: async (_path: string) =>
      new Response("hello blob", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
  });
  const req = new Request(`https://blossom.test/${testSha256}`);
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 200);
  const body = await res.text();
  assertEquals(body, "hello blob");
});

Deno.test("blob-get: HEAD returns 200 with headers for existing blob", async () => {
  const storage = makeStorage({
    head: async (_path: string) =>
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "text/html", "Content-Length": "9" },
      }),
  });
  const req = new Request(`https://blossom.test/${testSha256}`, { method: "HEAD" });
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 200);
});

Deno.test("blob-get: HEAD returns 404 for missing blob", async () => {
  const storage = makeStorage({
    head: async (_path: string) => null,
  });
  const req = new Request(`https://blossom.test/${testSha256}`, { method: "HEAD" });
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 404);
});

Deno.test("blob-get: returns BlobDescriptor JSON when Accept: application/json", async () => {
  const meta = {
    sha256: testSha256,
    size: 1024,
    type: "text/html",
    uploaded: 1700000000,
    owners: ["pubkey1"],
  };
  const storage = makeStorage({
    head: async (_path: string) =>
      new Response(null, { status: 200, headers: { "Content-Type": "text/html" } }),
    getJson: async (_path: string) => meta,
  });
  const req = new Request(`https://blossom.test/${testSha256}`, {
    headers: { "Accept": "application/json" },
  });
  const res = await handleBlobGet(req, storage, testConfig);
  assertEquals(res.status, 200);
  const descriptor = await res.json();
  assertEquals(descriptor.sha256, testSha256);
  assertEquals(typeof descriptor.url, "string");
  assertEquals(typeof descriptor.size, "number");
});
