import type { Config } from "../types.ts";
import { parse as parseToml } from "@std/toml";

/** Bunny Storage REST API client */
export class StorageClient {
  private baseUrl: string;
  private accessKey: string;
  private zone: string;
  public cdnHostname: string;

  constructor(config: Config) {
    this.baseUrl = `https://${config.storageHostname}/${config.storageUsername}`;
    this.accessKey = config.storagePassword;
    this.zone = config.storageUsername;
    this.cdnHostname = config.cdnHostname;
  }

  private headers(): Record<string, string> {
    return {
      AccessKey: this.accessKey,
    };
  }

  /** Upload/PUT a file to storage */
  async put(path: string, body: BodyInit, contentType?: string): Promise<boolean> {
    const headers: Record<string, string> = {
      ...this.headers(),
      "Content-Type": contentType || "application/octet-stream",
    };
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "PUT",
      headers,
      body,
    });
    return resp.status === 201;
  }

  /** Download/GET a file from storage. Returns null if not found. */
  async get(path: string): Promise<Response | null> {
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "GET",
      headers: this.headers(),
    });
    if (resp.status === 404) return null;
    return resp;
  }

  /** HEAD request — check if file exists and get headers */
  async head(path: string): Promise<Response | null> {
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "HEAD",
      headers: this.headers(),
    });
    if (resp.status === 404) return null;
    return resp;
  }

  /** Delete a file from storage */
  async delete(path: string): Promise<boolean> {
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    return resp.status === 200;
  }

  /** Read JSON from storage */
  async getJson<T>(path: string): Promise<T | null> {
    const resp = await this.get(path);
    if (!resp) return null;
    try {
      return (await resp.json()) as T;
    } catch {
      return null;
    }
  }

  /** Read raw text from storage */
  async getText(path: string): Promise<string | null> {
    const resp = await this.get(path);
    if (!resp) return null;
    try {
      return await resp.text();
    } catch {
      return null;
    }
  }

  /** Read and parse TOML from storage */
  async getToml<T>(path: string): Promise<T | null> {
    const text = await this.getText(path);
    if (!text) return null;
    try {
      return parseToml(text) as T;
    } catch {
      return null;
    }
  }

  /** Write JSON to storage */
  async putJson(path: string, data: unknown): Promise<boolean> {
    const body = new TextEncoder().encode(JSON.stringify(data));
    return this.put(path, body, "application/json");
  }

  /** Get the public CDN URL for a blob */
  blobUrl(sha256: string): string {
    const pre = sha256.substring(0, 2);
    return `https://${this.cdnHostname}/blobs/${pre}/${sha256}`;
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
   * Uses Bunny Storage REST API: GET /{zone}/{path}/ returns JSON array of file objects.
   * Returns relative paths (prefix + filename) for each file found.
   */
  async list(prefix: string): Promise<string[]> {
    // Ensure prefix ends with / for Bunny directory listing
    const dirPath = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const resp = await fetch(`${this.baseUrl}/${dirPath}`, {
      method: "GET",
      headers: {
        ...this.headers(),
        Accept: "application/json",
      },
    });
    if (resp.status === 404) return [];
    if (!resp.ok) {
      console.warn(`[storage] list ${dirPath} failed: ${resp.status}`);
      return [];
    }
    try {
      const entries: Array<{ ObjectName: string; IsDirectory: boolean }> = await resp.json();
      return entries
        .filter((e) => !e.IsDirectory)
        .map((e) => `${dirPath}${e.ObjectName}`);
    } catch {
      return [];
    }
  }
}
