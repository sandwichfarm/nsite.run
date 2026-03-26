import { parse as parseToml } from "@std/toml";
import { dirname, join } from "@std/path";

/**
 * Filesystem-backed storage client for local development.
 * Implements the same interface as StorageClient but reads/writes to the local filesystem
 * using Deno APIs instead of the Bunny Storage REST API.
 */
export class LocalStorageClient {
  private baseDir: string;
  private serverUrl: string;
  public cdnHostname: string;

  /**
   * @param baseDir  Local directory to store files under
   * @param serverUrl  Full URL the local blossom server is running on (e.g. "http://localhost:8082")
   */
  constructor(baseDir: string, serverUrl: string) {
    this.baseDir = baseDir.replace(/\/+$/, "");
    this.serverUrl = serverUrl.replace(/\/+$/, "");
    this.cdnHostname = new URL(serverUrl).host;
  }

  private fullPath(path: string): string {
    return join(this.baseDir, path);
  }

  /** Upload/PUT a file to local filesystem storage */
  async put(path: string, body: BodyInit, _contentType?: string): Promise<boolean> {
    const fullPath = this.fullPath(path);
    await Deno.mkdir(dirname(fullPath), { recursive: true });
    const bytes = new Uint8Array(await new Response(body).arrayBuffer());
    await Deno.writeFile(fullPath, bytes);
    return true;
  }

  /** Download/GET a file from local filesystem. Returns null if not found. */
  async get(path: string): Promise<Response | null> {
    const fullPath = this.fullPath(path);
    try {
      const bytes = await Deno.readFile(fullPath);
      return new Response(bytes);
    } catch {
      return null;
    }
  }

  /** HEAD request — check if file exists and get metadata */
  async head(path: string): Promise<Response | null> {
    const fullPath = this.fullPath(path);
    try {
      const stat = await Deno.stat(fullPath);
      return new Response(null, {
        status: 200,
        headers: {
          "content-length": String(stat.size),
        },
      });
    } catch {
      return null;
    }
  }

  /** Delete a file from local filesystem */
  async delete(path: string): Promise<boolean> {
    const fullPath = this.fullPath(path);
    try {
      await Deno.remove(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /** Read JSON from local filesystem */
  async getJson<T>(path: string): Promise<T | null> {
    const resp = await this.get(path);
    if (!resp) return null;
    try {
      return (await resp.json()) as T;
    } catch {
      return null;
    }
  }

  /** Read raw text from local filesystem */
  async getText(path: string): Promise<string | null> {
    const resp = await this.get(path);
    if (!resp) return null;
    try {
      return await resp.text();
    } catch {
      return null;
    }
  }

  /** Read and parse TOML from local filesystem */
  async getToml<T>(path: string): Promise<T | null> {
    const text = await this.getText(path);
    if (!text) return null;
    try {
      return parseToml(text) as T;
    } catch {
      return null;
    }
  }

  /** Write JSON to local filesystem */
  putJson(path: string, data: unknown): Promise<boolean> {
    const body = new TextEncoder().encode(JSON.stringify(data));
    return this.put(path, body, "application/json");
  }

  /**
   * Get the public URL for a blob.
   * For local dev, the blossom server serves blobs directly (not via CDN).
   */
  blobUrl(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `${this.serverUrl}/blobs/${pre}/${sha256}`;
  }

  /** Get the storage path for a blob */
  blobPath(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `blobs/${pre}/${sha256}`;
  }

  /** Get the storage path for blob metadata */
  metaPath(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `meta/${pre}/${sha256}.json`;
  }

  /** Get the storage path for a pubkey's blob index */
  listPath(pubkey: string): string {
    const pre = pubkey.substring(0, 2);
    return `lists/${pre}/${pubkey}/index.json`;
  }

  /** Get the storage path for reports on a blob */
  reportPath(sha256: string): string {
    return `reports/${sha256}.json`;
  }

  /**
   * List files under a storage prefix (directory listing).
   * Returns relative paths (prefix + filename) for each file found.
   * Returns an empty array if the directory doesn't exist.
   */
  async list(prefix: string): Promise<string[]> {
    // Ensure prefix ends with /
    const dirPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const fullDirPath = this.fullPath(dirPrefix);
    const results: string[] = [];

    try {
      for await (const entry of Deno.readDir(fullDirPath)) {
        if (!entry.isDirectory) {
          results.push(`${dirPrefix}${entry.name}`);
        }
      }
    } catch {
      // Directory doesn't exist — return empty array
      return [];
    }

    return results;
  }
}
