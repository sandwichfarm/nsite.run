/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { handleBlobList } from "./blob-list.ts";
import type { StorageClient } from "../storage/client.ts";
import type { Config } from "../types.ts";

const testPubkey = "b".repeat(64);

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

Deno.test("blob-list: returns empty array when no blobs", async () => {
  const storage = makeStorage({
    getJson: async (_path: string) => [],
  });
  const url = new URL(`https://blossom.test/list/${testPubkey}`);
  const req = new Request(url.href);
  const res = await handleBlobList(req, url, storage, testConfig);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, []);
});

Deno.test("blob-list: returns array of BlobDescriptors", async () => {
  const entry1 = {
    sha256: "a".repeat(64),
    size: 1024,
    type: "text/html",
    uploaded: 1700000000,
  };
  const entry2 = {
    sha256: "c".repeat(64),
    size: 2048,
    type: "image/png",
    uploaded: 1700001000,
  };
  const storage = makeStorage({
    getJson: async (_path: string) => [entry1, entry2],
  });
  const url = new URL(`https://blossom.test/list/${testPubkey}`);
  const req = new Request(url.href);
  const res = await handleBlobList(req, url, storage, testConfig);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.length, 2);
  assertEquals(body[0].sha256, entry1.sha256);
  assertEquals(body[1].sha256, entry2.sha256);
});

Deno.test("blob-list: respects since/until query params", async () => {
  const since = 1700000000;
  const until = 1700001500;
  const entries = [
    { sha256: "a".repeat(64), size: 100, type: "text/plain", uploaded: 1700000500 }, // in range
    { sha256: "b".repeat(64), size: 200, type: "text/plain", uploaded: 1699999999 }, // before since
    { sha256: "c".repeat(64), size: 300, type: "text/plain", uploaded: 1700002000 }, // after until
  ];
  const storage = makeStorage({
    getJson: async (_path: string) => entries,
  });
  const url = new URL(
    `https://blossom.test/list/${testPubkey}?since=${since}&until=${until}`,
  );
  const req = new Request(url.href);
  const res = await handleBlobList(req, url, storage, testConfig);
  assertEquals(res.status, 200);
  const body = await res.json();
  // Only the entry within [since, until] range should be returned
  assertEquals(body.length, 1);
  assertEquals(body[0].sha256, entries[0].sha256);
});
