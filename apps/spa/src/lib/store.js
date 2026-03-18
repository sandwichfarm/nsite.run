import { writable } from 'svelte/store';

/**
 * Creates a Svelte writable store that persists its value to localStorage.
 * Reads initial value from localStorage on creation, falls back to defaultValue
 * if not found or if JSON.parse fails.
 *
 * @param {string} key - localStorage key
 * @param {*} defaultValue - default value if not in localStorage
 * @returns {import('svelte/store').Writable}
 */
export function persistedStore(key, defaultValue) {
  let initial = defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      initial = JSON.parse(stored);
    }
  } catch {
    // JSON parse error or localStorage not available — fall back to default
    initial = defaultValue;
  }

  const store = writable(initial);

  store.subscribe((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage not available (e.g., SSR or private browsing with storage disabled)
    }
  });

  return store;
}

/**
 * Session store — persisted to localStorage.
 * Holds the current user's identity information.
 * NOTE: Do NOT store raw private key (Uint8Array) here — store hex or nsec string only.
 */
const DEFAULT_SESSION = {
  pubkey: null,
  signerType: null, // 'anonymous' | 'extension' | 'nostrconnect' | null
  displayName: null,
  avatar: null,
  npub: null,
};

// Sanitize restored session — NEVER allow nsec in any field
function sanitizeSession(s) {
  if (!s || typeof s !== 'object') return DEFAULT_SESSION;
  const fields = ['pubkey', 'npub', 'displayName', 'avatar'];
  for (const f of fields) {
    if (typeof s[f] === 'string' && s[f].startsWith('nsec')) {
      console.error(`SECURITY: nsec found in session.${f}, clearing session`);
      return DEFAULT_SESSION;
    }
  }
  return s;
}

const _rawSession = persistedStore('nsite_session', DEFAULT_SESSION);

// Wrap with sanitization on read
export const session = {
  subscribe: _rawSession.subscribe,
  set: (v) => _rawSession.set(sanitizeSession(v)),
  update: (fn) => _rawSession.update((s) => sanitizeSession(fn(s))),
};

// Clear any corrupted session on load
try {
  const stored = localStorage.getItem('nsite_session');
  if (stored && stored.includes('nsec1')) {
    console.error('SECURITY: nsec found in stored session, clearing');
    localStorage.removeItem('nsite_session');
    _rawSession.set(DEFAULT_SESSION);
  }
} catch { /* ignore */ }

/**
 * Deploy state — NOT persisted. Resets on page load.
 * Tracks the current deployment in progress.
 */
export const deployState = writable({
  step: 'idle', // 'idle' | 'hashing' | 'uploading' | 'publishing' | 'done' | 'error'
  files: [],
  warnings: [],
  progress: 0,
  result: null,
  error: null,
});

/**
 * Server configuration — persisted to localStorage.
 * Holds user-configured extra relays and blossom servers.
 */
export const serverConfig = persistedStore('nsite_servers', {
  extraRelays: [],
  extraBlossoms: ['https://nostr.download', 'https://blssm.us'],
});

