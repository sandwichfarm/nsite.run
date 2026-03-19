import { sha256 } from "@noble/hashes/sha256";

/** Pre-computed hex lookup table (avoids toString(16).padStart per byte) */
const HEX_TABLE: string[] = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

/** Convert bytes to hex string */
function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += HEX_TABLE[bytes[i]];
  }
  return hex;
}

/** SHA-256 hash of a Uint8Array, returned as hex string */
export function sha256Hex(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

/** SHA-256 hash of empty input — well-known constant */
export const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
