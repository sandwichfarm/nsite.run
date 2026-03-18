/**
 * Browser SHA-256 hashing via WebCrypto API.
 *
 * Uses crypto.subtle.digest — available in all modern browsers and
 * Node.js 15+ (which Vitest runs in).
 */

/**
 * Hash an ArrayBuffer using SHA-256 and return the hex digest string.
 *
 * @param {ArrayBuffer} arrayBuffer - The raw file bytes to hash.
 * @returns {Promise<string>} 64-character lowercase hex SHA-256 digest.
 */
export async function hashFile(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
