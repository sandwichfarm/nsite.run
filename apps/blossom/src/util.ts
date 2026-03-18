/** Decode base64 string to Uint8Array */
export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Shared regex for 64-char lowercase hex strings */
const HEX64_RE = /^[0-9a-f]{64}$/;

/** Validate that a string is a 64-char lowercase hex string (SHA-256) */
export function isValidSha256(hash: string): boolean {
  return HEX64_RE.test(hash);
}

/** Validate that a string is a 64-char lowercase hex pubkey */
export function isValidPubkey(pubkey: string): boolean {
  return HEX64_RE.test(pubkey);
}

/** Get 2-char prefix for sharded storage paths */
export function prefix(hash: string): string {
  return hash.substring(0, 2);
}

/** Create a JSON Response with proper headers */
export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

/** Create an error JSON response */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ message }, status);
}
