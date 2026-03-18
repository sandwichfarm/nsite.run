/**
 * Content-type detection, directory path resolution, and compression detection
 * for nsite gateway file serving.
 */

/** Static MIME type map covering common web asset types */
const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".jsx": "application/javascript",
  ".ts": "application/javascript",
  ".tsx": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".zip": "application/zip",
  ".gz": "application/gzip",
};

/**
 * Detect MIME type from file path or extension.
 * Returns "application/octet-stream" for unknown extensions.
 */
export function detectContentType(path: string): string {
  if (!path) return "application/octet-stream";
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";
  const ext = path.substring(dotIndex).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Resolve directory paths to index.html.
 * "/" → "/index.html", "/about/" → "/about/index.html", others unchanged.
 */
export function resolveIndexPath(pathname: string): string {
  if (pathname === "/") return "/index.html";
  if (pathname.endsWith("/")) return pathname + "index.html";
  return pathname;
}

/** Compression detection result */
export interface CompressionResult {
  encoding: string;
  basePath: string;
}

/**
 * Detect if a path refers to a compressed asset.
 * Returns encoding and base path, or null if uncompressed.
 *
 * - ".br" → { encoding: "br", basePath: path without .br }
 * - ".gz" → { encoding: "gzip", basePath: path without .gz }
 */
export function detectCompression(path: string): CompressionResult | null {
  if (path.endsWith(".br")) {
    return { encoding: "br", basePath: path.slice(0, -3) };
  }
  if (path.endsWith(".gz")) {
    return { encoding: "gzip", basePath: path.slice(0, -3) };
  }
  return null;
}
