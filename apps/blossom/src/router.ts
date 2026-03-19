import type { Config } from "./types.ts";
import type { StorageClient } from "./storage/client.ts";
import { handleOptions, withCors } from "./middleware/cors.ts";
import { errorResponse } from "./util.ts";

// Handlers
import { handleBlobGet } from "./handlers/blob-get.ts";
import { handleBlobUpload } from "./handlers/blob-upload.ts";
import { handleBlobDelete } from "./handlers/blob-delete.ts";
import { handleBlobList } from "./handlers/blob-list.ts";
import { handleMirror } from "./handlers/mirror.ts";
import { handleUploadCheck } from "./handlers/upload-check.ts";
import { handleReport } from "./handlers/report.ts";
import { handleServerInfo } from "./handlers/server-info.ts";

/** Pre-compiled blob path regexes (avoid re-creation per request) */
const BLOB_PATH_RE = /^\/[0-9a-f]{64}/;
const BLOB_PATH_EXACT_RE = /^\/[0-9a-f]{64}$/;

export async function route(
  request: Request,
  storage: StorageClient,
  config: Config,
): Promise<Response> {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return handleOptions();
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  let response: Response;

  try {
    // PUT /upload — BUD-02: Upload blob
    if (path === "/upload" && method === "PUT") {
      response = await handleBlobUpload(request, storage, config);
    } // HEAD /upload — BUD-06: Upload pre-flight check
    else if (path === "/upload" && method === "HEAD") {
      response = await handleUploadCheck(request, storage, config);
    } // PUT /mirror — BUD-04: Mirror a blob from URL
    else if (path === "/mirror" && method === "PUT") {
      response = await handleMirror(request, storage, config);
    } // PUT /report — BUD-09: Content reporting
    else if (path === "/report" && method === "PUT") {
      response = await handleReport(request, storage, config);
    } // GET /list/<pubkey> — BUD-02: List blobs by pubkey
    else if (path.startsWith("/list/") && method === "GET") {
      response = await handleBlobList(request, url, storage, config);
    } // GET or HEAD /<sha256> — BUD-01: Retrieve blob
    else if ((method === "GET" || method === "HEAD") && BLOB_PATH_RE.test(path)) {
      response = await handleBlobGet(request, storage, config);
    } // DELETE /<sha256> — BUD-02: Delete blob
    else if (method === "DELETE" && BLOB_PATH_EXACT_RE.test(path)) {
      response = await handleBlobDelete(request, storage, config);
    } // GET /server-info — public server configuration
    else if (path === "/server-info" && method === "GET") {
      response = await handleServerInfo(storage, config);
    } // 404 for everything else
    else {
      response = errorResponse("Not Found", 404);
    }
  } catch (err) {
    console.error("Handler error:", err);
    response = errorResponse("Internal Server Error", 500);
  }

  return withCors(response);
}
