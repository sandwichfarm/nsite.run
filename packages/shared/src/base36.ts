const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = 36n;
const LENGTH = 50;
const BYTES = 32;
const MAX_VALUE = (1n << (BigInt(BYTES) * 8n)) - 1n;
const VALID_RE = /^[a-z0-9]{50}$/;

/**
 * Encode 32 bytes as a zero-padded 50-character lowercase base36 string.
 * bytes[0] is the most significant byte (big-endian).
 */
export function base36Encode(bytes: Uint8Array): string {
  // Convert big-endian bytes to a BigInt
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }

  // Divmod loop — produces digits least-significant first
  const digits: string[] = [];
  while (value > 0n) {
    const rem = value % BASE;
    digits.push(ALPHABET[Number(rem)]);
    value = value / BASE;
  }

  // Reverse to get most-significant first, then left-pad with '0' to LENGTH
  const encoded = digits.reverse().join("");
  return encoded.padStart(LENGTH, "0");
}

/**
 * Decode a 50-character lowercase base36 string back to a 32-byte Uint8Array.
 * Returns null if the string is not exactly 50 chars, contains chars outside
 * [a-z0-9], or decodes to a value that exceeds 32 bytes (>= 2^256).
 */
export function base36Decode(s: string): Uint8Array | null {
  if (!VALID_RE.test(s)) return null;

  // Convert base36 string to a BigInt
  let value = 0n;
  for (let i = 0; i < s.length; i++) {
    const digit = ALPHABET.indexOf(s[i]);
    value = value * BASE + BigInt(digit);
  }

  // Guard against overflow (value must fit in 32 bytes)
  if (value > MAX_VALUE) return null;

  // Extract 32 bytes big-endian
  const result = new Uint8Array(BYTES);
  for (let i = BYTES - 1; i >= 0; i--) {
    result[i] = Number(value & 0xffn);
    value >>= 8n;
  }

  return result;
}
