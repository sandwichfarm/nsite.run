/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { handleServerInfo } from "./server-info.ts";
import type { StorageClient } from "../storage/client.ts";
import type { Config } from "../types.ts";

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

Deno.test("server-info: returns correct response shape", async () => {
  const storage = makeStorage();
  const res = await handleServerInfo(storage, testConfig);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(typeof body.name, "string");
  assertEquals(body.public, true);
  assertEquals(body.paymentsEnabled, false);
  assertEquals(body.serverUrl, testConfig.serverUrl);
  assertEquals(body.maxUploadSize, testConfig.maxUploadSize);
});

Deno.test("server-info: includes Cache-Control header", async () => {
  const storage = makeStorage();
  const res = await handleServerInfo(storage, testConfig);
  const cacheControl = res.headers.get("Cache-Control");
  assertEquals(cacheControl !== null, true);
  assertEquals(cacheControl?.includes("public"), true);
  assertEquals(cacheControl?.includes("max-age=60"), true);
});
