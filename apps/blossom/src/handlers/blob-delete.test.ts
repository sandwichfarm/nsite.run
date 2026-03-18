/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { generateSecretKey, getPublicKey, finalizeEvent } from "@nostr/tools/pure";
import { handleBlobDelete } from "./blob-delete.ts";
import type { StorageClient } from "../storage/client.ts";
import type { Config } from "../types.ts";

const testSha256 = "d".repeat(64);

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

/** Build a kind 24242 signed delete auth header */
function makeDeleteAuth(sha256: string, secretKey: Uint8Array): string {
  const event = finalizeEvent(
    {
      kind: 24242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["t", "delete"],
        ["x", sha256],
        ["expiration", String(Math.floor(Date.now() / 1000) + 600)],
      ],
      content: "delete blob",
    },
    secretKey,
  );
  return "Nostr " + btoa(JSON.stringify(event));
}

Deno.test("blob-delete: returns 401 without Authorization header", async () => {
  const storage = makeStorage();
  const req = new Request(`https://blossom.test/${testSha256}`, { method: "DELETE" });
  const res = await handleBlobDelete(req, storage, testConfig);
  assertEquals(res.status, 401);
});

Deno.test("blob-delete: returns 403 when pubkey is not an owner", async () => {
  const secretKey = generateSecretKey();
  const authHeader = makeDeleteAuth(testSha256, secretKey);

  const storage = makeStorage({
    getJson: async (_path: string) => ({
      sha256: testSha256,
      size: 100,
      type: "text/plain",
      uploaded: 1700000000,
      owners: ["other_pubkey_" + "0".repeat(52)], // does not include authed pubkey
    }),
  });

  const req = new Request(`https://blossom.test/${testSha256}`, {
    method: "DELETE",
    headers: { "Authorization": authHeader },
  });
  const res = await handleBlobDelete(req, storage, testConfig);
  assertEquals(res.status, 403);
});

Deno.test("blob-delete: removes ownership and returns updated descriptor", async () => {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const authHeader = makeDeleteAuth(testSha256, secretKey);

  const meta = {
    sha256: testSha256,
    size: 100,
    type: "text/plain",
    uploaded: 1700000000,
    owners: [pubkey, "other_owner_pubkey_" + "0".repeat(45)], // pubkey is an owner
  };

  const storage = makeStorage({
    getJson: async (_path: string) => meta,
    putJson: async (_path: string, _data: unknown) => true,
    delete: async (_path: string) => true,
  });

  const req = new Request(`https://blossom.test/${testSha256}`, {
    method: "DELETE",
    headers: { "Authorization": authHeader },
  });
  const res = await handleBlobDelete(req, storage, testConfig);
  assertEquals(res.status, 200);
  const descriptor = await res.json();
  assertEquals(descriptor.sha256, testSha256);
});

Deno.test("blob-delete: deletes blob from storage when last owner removes", async () => {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const authHeader = makeDeleteAuth(testSha256, secretKey);

  let deleteCalledPath = "";
  const meta = {
    sha256: testSha256,
    size: 100,
    type: "text/plain",
    uploaded: 1700000000,
    owners: [pubkey], // single owner — blob should be deleted when owner removed
  };

  const storage = makeStorage({
    getJson: async (_path: string) => meta,
    putJson: async (_path: string, _data: unknown) => true,
    delete: async (path: string) => {
      deleteCalledPath = path;
      return true;
    },
  });

  const req = new Request(`https://blossom.test/${testSha256}`, {
    method: "DELETE",
    headers: { "Authorization": authHeader },
  });
  const res = await handleBlobDelete(req, storage, testConfig);
  assertEquals(res.status, 200);
  // When last owner removes blob, storage.delete should be called for the blob path
  assertEquals(deleteCalledPath.includes(testSha256), true);
});
