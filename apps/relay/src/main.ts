import { createClient } from "@libsql/client/web";
import process from "node:process";
import { initSchema } from "./db.ts";
import { buildNip11Response } from "./nip11.ts";
import { handleWebSocketUpgrade } from "./relay.ts";

declare const Bunny: {
  v1: {
    serve: (
      handler: (req: Request) => Response | Promise<Response>,
    ) => void;
  };
};

// Create DB client at module level using official @libsql/client
const db = createClient({
  url: process.env.BUNNY_DB_URL ?? "",
  authToken: process.env.BUNNY_DB_AUTH_TOKEN ?? "",
});

Bunny.v1.serve(async (request: Request): Promise<Response> => {
  // WebSocket upgrade
  if (
    request.headers.get("upgrade")?.toLowerCase() === "websocket" ||
    request.headers.has("sec-websocket-key")
  ) {
    // deno-lint-ignore no-explicit-any
    const { response, socket } = (request as any).upgradeWebSocket();
    handleWebSocketUpgrade(socket, db, null);
    return response;
  }

  // Schema init on HTTP requests
  await initSchema(db);

  // NIP-11: HTTP GET with Accept: application/nostr+json
  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("application/nostr+json")
  ) {
    return buildNip11Response();
  }

  // Fallback for plain HTTP requests
  return new Response("nsite relay - connect via WebSocket", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
