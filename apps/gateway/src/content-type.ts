/**
 * Content-type detection, directory path resolution, and compression detection
 * for nsite gateway file serving.
 */

import { contentType, typeByExtension } from "@std/media-types";

/**
 * Detect MIME type from file path or extension.
 * Returns "application/octet-stream" for unknown extensions.
 */
export function detectContentType(path: string): string {
  if (!path) return "application/octet-stream";
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";
  const ext = path.substring(dotIndex).toLowerCase();
  const type = typeByExtension(ext);
  if (!type) return "application/octet-stream";

  return contentType(type) ?? type;
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
