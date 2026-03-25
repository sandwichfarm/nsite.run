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
 * Default session shape — exported so consumers can reference it.
 */
export const DEFAULT_SESSION = {
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

/**
 * Factory function that creates a fresh set of deployer stores.
 * Multi-instance safe — each call produces independent store instances
 * backed by the same localStorage keys (keyed by storagePrefix).
 *
 * @param {{ storagePrefix?: string }} [options]
 * @returns {{ session: object, deployState: import('svelte/store').Writable, serverConfig: import('svelte/store').Writable }}
 */
export function createDeployerStores(options = {}) {
  const prefix = options.storagePrefix ?? 'nsite';

  const _rawSession = persistedStore(`${prefix}_session`, DEFAULT_SESSION);
  const session = {
    subscribe: _rawSession.subscribe,
    set: (v) => _rawSession.set(sanitizeSession(v)),
    update: (fn) => _rawSession.update((s) => sanitizeSession(fn(s))),
  };

  // Clear any corrupted session on load
  try {
    const stored = localStorage.getItem(`${prefix}_session`);
    if (stored && stored.includes('nsec1')) {
      console.error('SECURITY: nsec found in stored session, clearing');
      localStorage.removeItem(`${prefix}_session`);
      _rawSession.set(DEFAULT_SESSION);
    }
  } catch { /* ignore */ }

  /**
   * Deploy state — NOT persisted. Resets on page load.
   * Tracks the current deployment in progress.
   */
  const deployState = writable({
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
  const serverConfig = persistedStore(`${prefix}_servers`, {
    extraRelays: [],
    extraBlossoms: ['https://nostr.download', 'https://blssm.us'],
  });

  return { session, deployState, serverConfig };
}

/**
 * sessionStorage key used to persist the anonymous private key (as hex) across page reloads.
 * The key is scoped to the browser tab session — it is automatically cleared when the tab closes.
 */
export const ANON_KEY_STORAGE_KEY = 'nsite_anon_key';
