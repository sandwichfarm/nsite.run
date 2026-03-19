/**
 * Minimal libSQL HTTP client using the Hrana v2 pipeline protocol.
 * Replaces @libsql/client/web (~80KB+ with cross-fetch, hrana-client, js-base64)
 * with raw fetch() calls to stay within Bunny Edge Scripting's cold-start timeout.
 *
 * Only implements the two methods used by the codebase:
 * - execute(stmt): single statement, returns { rows }
 * - batch(stmts): multiple statements, atomic
 */

export type SqlValue = string | number | null;

export interface ResultSet {
  rows: SqlValue[][];
}

export interface Client {
  execute(
    stmt: string | { sql: string; args: SqlValue[] },
  ): Promise<ResultSet>;
  batch(
    stmts: Array<{ sql: string; args: SqlValue[] }>,
    mode?: string,
  ): Promise<void>;
}

interface HranaValue {
  type: string;
  value?: string;
}

function encodeValue(
  v: SqlValue,
): { type: "null" } | { type: string; value: string } {
  if (v === null || v === undefined) return { type: "null" };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { type: "integer", value: String(v) }
      : { type: "float", value: String(v) };
  }
  return { type: "text", value: String(v) };
}

function decodeValue(v: HranaValue): SqlValue {
  if (v.type === "null") return null;
  if (v.type === "integer") return parseInt(v.value!, 10);
  if (v.type === "float") return parseFloat(v.value!);
  return v.value ?? null;
}

export function createClient(config: {
  url: string;
  authToken: string;
}): Client {
  // Convert libsql:// to https://
  const baseUrl = config.url
    .replace(/^libsql:\/\//, "https://")
    .replace(/\/$/, "");

  async function pipeline(
    requests: unknown[],
  ): Promise<
    Array<{
      type: string;
      response?: { type: string; result?: { rows: HranaValue[][] } };
      error?: { message: string };
    }>
  > {
    const resp = await fetch(`${baseUrl}/v2/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify({
        requests: [...requests, { type: "close" }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`libsql HTTP ${resp.status}: ${text}`);
    }

    const data = (await resp.json()) as {
      results: Array<{
        type: string;
        response?: { type: string; result?: { rows: HranaValue[][] } };
        error?: { message: string };
      }>;
    };
    return data.results;
  }

  function encodeStmt(stmt: string | { sql: string; args: SqlValue[] }) {
    if (typeof stmt === "string") {
      return { sql: stmt, args: [] as Array<{ type: string }> };
    }
    return { sql: stmt.sql, args: (stmt.args ?? []).map(encodeValue) };
  }

  return {
    async execute(stmt) {
      const results = await pipeline([
        { type: "execute", stmt: encodeStmt(stmt) },
      ]);

      const result = results[0];
      if (result.type === "error") {
        throw new Error(result.error?.message ?? "DB execute error");
      }

      const rows = (result.response?.result?.rows ?? []).map(
        (row: HranaValue[]) => row.map(decodeValue),
      );
      return { rows };
    },

    async batch(stmts, _mode?) {
      const results = await pipeline([
        {
          type: "batch",
          batch: {
            steps: stmts.map((s) => ({ stmt: encodeStmt(s) })),
          },
        },
      ]);

      const result = results[0];
      if (result.type === "error") {
        throw new Error(result.error?.message ?? "DB batch error");
      }
    },
  };
}
