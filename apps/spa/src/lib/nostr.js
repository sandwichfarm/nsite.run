import { PrivateKeySigner, ExtensionSigner, NostrConnectSigner } from 'applesauce-signers';
import { RelayPool } from 'applesauce-relay/pool';
import { nsecEncode } from 'nostr-tools/nip19';
import { bytesToHex, hexToBytes } from 'nostr-tools/utils';
import { ANON_KEY_STORAGE_KEY } from './store.js';

/**
 * Default relays used for NIP-46 handshake and bootstrap queries.
 * IMPORTANT: Do NOT include wss://nsite.run here — the nsite relay is kind-restricted
 * and rejects NIP-46 kind 24133 messages.
 */
export const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net'];

/**
 * Derive relay and blossom URLs from the current page origin.
 * The relay/blossom/gateway always live at the same domain as the SPA.
 *
 * In development, override with VITE_NSITE_RELAY and VITE_NSITE_BLOSSOM env vars.
 */
const _origin = typeof window !== 'undefined' ? window.location.origin : 'https://nsite.run';
const _wsProtocol = _origin.startsWith('https') ? 'wss' : 'ws';
const _host = typeof window !== 'undefined' ? window.location.host : 'nsite.run';

/** The relay for publishing manifests (kind 15128). */
export const NSITE_RELAY = import.meta.env.VITE_NSITE_RELAY || `${_wsProtocol}://${_host}`;

/** The blossom server for blob uploads. */
export const NSITE_BLOSSOM = import.meta.env.VITE_NSITE_BLOSSOM || _origin;

/** @type {RelayPool | null} */
let _pool = null;

/**
 * Returns a lazy singleton RelayPool instance.
 * @returns {RelayPool}
 */
export function getRelayPool() {
  if (!_pool) {
    _pool = new RelayPool();
  }
  return _pool;
}

/**
 * Creates an anonymous signer with a fresh ephemeral keypair.
 * @returns {Promise<{signer: PrivateKeySigner, pubkey: string, nsec: string}>}
 */
export async function createAnonymousSigner() {
  const signer = new PrivateKeySigner();
  const pubkey = await signer.getPublicKey();
  const nsec = nsecEncode(signer.key);
  return { signer, pubkey, nsec };
}

/**
 * Restores an anonymous signer from a hex private key stored in sessionStorage.
 * @returns {Promise<{signer: PrivateKeySigner, pubkey: string, nsec: string} | null>}
 */
export async function restoreAnonymousSigner() {
  try {
    const hexKey = sessionStorage.getItem(ANON_KEY_STORAGE_KEY);
    if (!hexKey || hexKey.length !== 64) return null;
    const keyBytes = hexToBytes(hexKey);
    const signer = new PrivateKeySigner(keyBytes);
    const pubkey = await signer.getPublicKey();
    const nsec = nsecEncode(signer.key);
    return { signer, pubkey, nsec };
  } catch {
    return null;
  }
}

/**
 * Saves the anonymous signer's private key as hex to sessionStorage.
 * @param {PrivateKeySigner} signer
 */
export function saveAnonymousKey(signer) {
  try {
    sessionStorage.setItem(ANON_KEY_STORAGE_KEY, bytesToHex(signer.key));
  } catch { /* sessionStorage not available */ }
}

/**
 * Clears the anonymous key from sessionStorage.
 */
export function clearAnonymousKey() {
  try {
    sessionStorage.removeItem(ANON_KEY_STORAGE_KEY);
  } catch { /* ignore */ }
}

/**
 * Triggers a file download containing the nsec string.
 * Filename: nsite-nsec-{npub-prefix}.txt
 * @param {string} nsec - nsec1... bech32 string
 * @param {string} npub - npub1... bech32 string (used for filename)
 */
export function downloadNsecFile(nsec, npub) {
  const prefix = npub ? npub.slice(0, 12) : 'unknown';
  const filename = `nsite-nsec-${prefix}.txt`;
  const blob = new Blob([nsec], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Creates an extension signer that proxies window.nostr.
 * @returns {Promise<{signer: ExtensionSigner, pubkey: string}>}
 * @throws {import('applesauce-signers').ExtensionMissingError} if no extension is found
 */
export async function createExtensionSigner() {
  const signer = new ExtensionSigner();
  const pubkey = await signer.getPublicKey();
  return { signer, pubkey };
}

/**
 * Creates a NIP-46 NostrConnect signer and generates a nostrconnect:// URI for QR display.
 * Uses DEFAULT_RELAYS (NOT wss://nsite.run — nsite rejects kind 24133).
 *
 * @param {string[]} [relays] - Optional relay list, defaults to DEFAULT_RELAYS
 * @returns {{ signer: NostrConnectSigner, uri: string, waitForSigner: () => Promise<void> }}
 */
export function createNostrConnectSigner(relays) {
  const pool = getRelayPool();
  NostrConnectSigner.pool = pool;

  const connectRelays = relays ?? DEFAULT_RELAYS;

  const signer = new NostrConnectSigner({
    relays: connectRelays,
    signer: new PrivateKeySigner(), // ephemeral client keypair
  });

  const uri = signer.getNostrConnectURI({
    name: 'nsite.run Deploy',
    url: 'https://nsite.run',
  });

  return {
    signer,
    uri,
    waitForSigner: () => signer.waitForSigner(),
  };
}

/**
 * Connects to a remote signer via a bunker:// URI.
 * @param {string} bunkerUri - The bunker:// URI from the remote signer
 * @returns {Promise<{signer: NostrConnectSigner, pubkey: string}>}
 */
export async function connectFromBunkerURI(bunkerUri) {
  const pool = getRelayPool();
  NostrConnectSigner.pool = pool;

  const signer = await NostrConnectSigner.fromBunkerURI(bunkerUri, {});
  const pubkey = await signer.getPublicKey();
  return { signer, pubkey };
}

/**
 * Opens a WebSocket connection to a relay, sends a REQ, collects events until EOSE, then closes.
 * @param {string} url - Relay WebSocket URL
 * @param {object} filter - Nostr filter object
 * @returns {Promise<object[]>} Array of events received before EOSE
 */
export function queryRelay(url, filter) {
  return new Promise((resolve, reject) => {
    let ws;
    const events = [];
    const subId = `query_${Math.random().toString(36).slice(2, 9)}`;

    const timeout = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      resolve(events); // Return whatever we got on timeout
    }, 8000);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify(['REQ', subId, filter]));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!Array.isArray(msg)) return;

        if (msg[0] === 'EVENT' && msg[1] === subId) {
          events.push(msg[2]);
        } else if (msg[0] === 'EOSE' && msg[1] === subId) {
          clearTimeout(timeout);
          ws.send(JSON.stringify(['CLOSE', subId]));
          ws.close();
          resolve(events);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(events); // Return what we have on error
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      // Resolve with what we have if not already resolved
    };
  });
}

/** In-memory profile cache: pubkey → profile object */
const _profileCache = new Map();

/**
 * Fetches a user's kind 0 profile from their relays.
 * Results are cached in memory so repeated calls for the same pubkey don't re-query.
 * @param {string} pubkey - User's hex pubkey
 * @param {string[]} relays - Relay URLs to query
 * @param {boolean} [skipCache=false] - Force re-fetch even if cached
 * @returns {Promise<{name?: string, display_name?: string, picture?: string, about?: string} | null>}
 */
export async function fetchProfile(pubkey, relays, skipCache = false) {
  if (!skipCache && _profileCache.has(pubkey)) {
    return _profileCache.get(pubkey);
  }

  const filter = { kinds: [0], authors: [pubkey], limit: 1 };

  for (const relay of relays) {
    try {
      const events = await queryRelay(relay, filter);
      if (events.length > 0) {
        const event = events[0];
        try {
          const profile = JSON.parse(event.content);
          const result = {
            name: profile.name,
            display_name: profile.display_name,
            picture: profile.picture,
            about: profile.about,
          };
          _profileCache.set(pubkey, result);
          return result;
        } catch { /* invalid JSON content */ }
      }
    } catch { /* relay unavailable */ }
  }

  return null;
}

/**
 * Fetches a user's kind 10002 relay list and returns write relay URLs.
 * @param {string} pubkey - User's hex pubkey
 * @param {string[]} relays - Bootstrap relay URLs to query
 * @returns {Promise<string[]>} Array of relay URLs
 */
export async function fetchRelayList(pubkey, relays) {
  const filter = { kinds: [10002], authors: [pubkey], limit: 1 };

  for (const relay of relays) {
    try {
      const events = await queryRelay(relay, filter);
      if (events.length > 0) {
        const event = events[0];
        const urls = [];
        for (const tag of event.tags ?? []) {
          if (tag[0] === 'r' && tag[1]) {
            urls.push(tag[1]);
          }
        }
        if (urls.length > 0) return urls;
      }
    } catch { /* relay unavailable */ }
  }

  return [];
}

/**
 * Fetches a user's kind 10063 blossom server list.
 * @param {string} pubkey - User's hex pubkey
 * @param {string[]} relays - Bootstrap relay URLs to query
 * @returns {Promise<string[]>} Array of blossom server URLs
 */
export async function fetchBlossomList(pubkey, relays) {
  const filter = { kinds: [10063], authors: [pubkey], limit: 1 };

  for (const relay of relays) {
    try {
      const events = await queryRelay(relay, filter);
      if (events.length > 0) {
        const event = events[0];
        const servers = [];
        for (const tag of event.tags ?? []) {
          if (tag[0] === 'server' && tag[1]) {
            servers.push(tag[1]);
          }
        }
        if (servers.length > 0) return servers;
      }
    } catch { /* relay unavailable */ }
  }

  return [];
}

/**
 * Fetches the most recent kind 15128 manifest for a pubkey across multiple relays.
 * Queries all relays in parallel and returns the newest manifest event.
 * @param {string} pubkey - User's hex pubkey
 * @param {string[]} relays - Relay URLs to query (should include NIP-65 relays + NSITE_RELAY)
 * @returns {Promise<object|null>} Most recent manifest event, or null if none found
 */
export async function fetchExistingManifest(pubkey, relays) {
  const filter = { kinds: [15128], authors: [pubkey], limit: 1 };
  const allEvents = [];
  const seen = new Set();

  const results = await Promise.allSettled(
    relays.map(relay => queryRelay(relay, filter))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const event of result.value) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          allEvents.push(event);
        }
      }
    }
  }

  if (allEvents.length === 0) return null;

  // Return the most recent manifest
  allEvents.sort((a, b) => b.created_at - a.created_at);
  return allEvents[0];
}

/**
 * Returns true if the manifest event has zero path tags (empty/deleted manifest).
 * @param {object} event - Nostr event
 * @returns {boolean}
 */
function isEmptyManifest(event) {
  return !event.tags.some(t => t[0] === 'path');
}

/**
 * Fetches all manifests (root kind 15128 and named kind 35128) for a pubkey.
 * Queries all relays in parallel with two filters simultaneously.
 * Deduplicates by event ID, filters out empty manifests.
 *
 * @param {string} pubkey - User's hex pubkey
 * @param {string[]} relays - Relay URLs to query
 * @returns {Promise<{ root: object|null, named: object[] }>}
 *   root: the most recent non-empty kind 15128 manifest, or null
 *   named: array of most-recent-per-dTag non-empty kind 35128 manifests, sorted by created_at descending
 */
export async function fetchAllManifests(pubkey, relays) {
  const rootFilter = { kinds: [15128], authors: [pubkey], limit: 1 };
  const namedFilter = { kinds: [35128], authors: [pubkey] };

  const seen = new Set();
  const rootEvents = [];
  const namedEvents = [];

  // Query all relays for both filters in parallel
  const queryPromises = relays.flatMap(relay => [
    queryRelay(relay, rootFilter),
    queryRelay(relay, namedFilter),
  ]);

  const results = await Promise.allSettled(queryPromises);

  // Results are interleaved: [relay0-root, relay0-named, relay1-root, relay1-named, ...]
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status !== 'fulfilled') continue;
    // Even indices = root filter results, odd indices = named filter results
    const isRootResult = i % 2 === 0;
    for (const event of result.value) {
      if (seen.has(event.id)) continue;
      seen.add(event.id);
      if (isRootResult) {
        rootEvents.push(event);
      } else {
        namedEvents.push(event);
      }
    }
  }

  // Root: pick the most recent non-empty event
  rootEvents.sort((a, b) => b.created_at - a.created_at);
  const rootManifest = rootEvents.find(e => !isEmptyManifest(e)) ?? null;

  // Named: group by d-tag, keep most recent per d-tag, filter empty, sort by created_at desc
  const byDTag = new Map();
  for (const event of namedEvents) {
    const dTag = getManifestDTag(event);
    if (!dTag) continue;
    const existing = byDTag.get(dTag);
    if (!existing || event.created_at > existing.created_at) {
      byDTag.set(dTag, event);
    }
  }
  const namedManifests = [...byDTag.values()]
    .filter(e => !isEmptyManifest(e))
    .sort((a, b) => b.created_at - a.created_at);

  return { root: rootManifest, named: namedManifests };
}

/**
 * Extracts the d-tag value from a manifest event's tags array.
 * @param {object} event - Nostr event
 * @returns {string|null}
 */
export function getManifestDTag(event) {
  return event.tags.find(t => t[0] === 'd')?.[1] || null;
}

/**
 * Extracts the title from a manifest event's tags array.
 * @param {object} event - Nostr event
 * @returns {string} Empty string if no title tag present
 */
export function getManifestTitle(event) {
  return event.tags.find(t => t[0] === 'title')?.[1] || '';
}

/**
 * Extracts the description from a manifest event's tags array.
 * @param {object} event - Nostr event
 * @returns {string} Empty string if no description tag present
 */
export function getManifestDescription(event) {
  return event.tags.find(t => t[0] === 'description')?.[1] || '';
}
