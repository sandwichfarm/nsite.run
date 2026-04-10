const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = 36n;
const LENGTH = 50;

/**
 * Encode 32 bytes as a zero-padded 50-character lowercase base36 string.
 * Bytes are treated as big-endian (bytes[0] is most significant).
 *
 * This is a JS port of the base36Encode function from packages/shared/src/base36.ts.
 *
 * @param {Uint8Array} bytes - 32-byte input (e.g., a pubkey)
 * @returns {string} 50-character lowercase base36 string
 */
export function base36Encode(bytes) {
  // Convert big-endian bytes to a BigInt
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }

  // Divmod loop — produces digits least-significant first
  const digits = [];
  while (value > 0n) {
    const rem = value % BASE;
    digits.push(ALPHABET[Number(rem)]);
    value = value / BASE;
  }

  // Reverse to get most-significant first, then left-pad with '0' to 50 chars
  const encoded = digits.reverse().join('');
  return encoded.padStart(50, '0');
}
