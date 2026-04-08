import { decode, npubEncode } from "nostr-tools/nip19";
import type { EventTemplate, SignedEvent } from "./signer";

export type { EventTemplate, SignedEvent };

export interface NsiteContext {
  pubkey: string;
  identifier?: string;
  baseDomain: string;
}

export interface Muse {
  index: number;
  pubkey: string;
  relays: string[];
}

export interface MuseProfile {
  npub: string;
  name?: string;
  nsiteUrl?: string;
}

const BOOTSTRAP_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://nos.lol",
];
const PROFILE_RELAYS = [
  "wss://purplepag.es",
  "wss://user.kindpag.es",
  "wss://indexer.hzrd149.com",
  "wss://profiles.nostr1.com",
  "wss://nos.lol",
];
const B36_LEN = 50;
const D_TAG_RE = /^[a-z0-9-]{1,13}$/;
const NAMED_LABEL_RE = /^[0-9a-z]{50}[a-z0-9-]{1,13}$/;

// --- Base36 ---

export function pubkeyToBase36(hex: string): string {
  return BigInt("0x" + hex)
    .toString(36)
    .padStart(B36_LEN, "0");
}

function base36ToHex(b36: string): string {
  let n = 0n;
  for (const c of b36) n = n * 36n + BigInt(parseInt(c, 36));
  return n.toString(16).padStart(64, "0");
}

// --- NIP-19 ---

function npubDecode(npub: string): string | null {
  try {
    const result = decode(npub);
    if (result.type !== "npub") return null;
    return result.data;
  } catch (error) {
    return null;
  }
}

export { npubEncode };

// --- Context ---

export function parseContext(): NsiteContext | null {
  const parts = window.location.hostname.split(".");

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("npub1") && parts[i].length >= 63) {
      const pubkey = npubDecode(parts[i]);
      if (pubkey) return { pubkey, baseDomain: parts.slice(i + 1).join(".") };
    }
  }

  const label = parts[0];
  if (
    label &&
    label.length > B36_LEN &&
    label.length <= 63 &&
    NAMED_LABEL_RE.test(label) &&
    !label.endsWith("-")
  ) {
    try {
      const pubkey = base36ToHex(label.slice(0, B36_LEN));
      return {
        pubkey,
        identifier: label.slice(B36_LEN),
        baseDomain: parts.slice(1).join("."),
      };
    } catch {
      /* invalid */
    }
  }

  return null;
}

export function isValidDTag(s: string): boolean {
  return D_TAG_RE.test(s) && !s.endsWith("-");
}

// --- Relay communication ---

interface RelayEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function withSocket(
  url: string,
  sendMsg: unknown[],
  onMsg: (data: unknown[]) => boolean,
  timeout = 5000,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch { /* */ }
        resolve();
      }, timeout);
      const finish = () => {
        clearTimeout(timer);
        try {
          ws.close();
        } catch { /* */ }
        resolve();
      };
      ws.onopen = () => ws.send(JSON.stringify(sendMsg));
      ws.onmessage = (e) => {
        try {
          if (onMsg(JSON.parse(e.data))) finish();
        } catch { /* */ }
      };
      ws.onerror = () => finish();
    } catch {
      resolve();
    }
  });
}

async function queryRelays(
  urls: string[],
  filter: Record<string, unknown>,
): Promise<RelayEvent[]> {
  const events = new Map<string, RelayEvent>();
  const subId = Math.random().toString(36).slice(2, 8);
  await Promise.allSettled(
    urls.map((url) =>
      withSocket(url, ["REQ", subId, filter], (msg) => {
        if (msg[0] === "EVENT" && msg[1] === subId) {
          events.set((msg[2] as RelayEvent).id, msg[2] as RelayEvent);
        }
        return msg[0] === "EOSE" && msg[1] === subId;
      })
    ),
  );
  return [...events.values()];
}

async function publishRelay(url: string, event: SignedEvent): Promise<boolean> {
  let ok = false;
  await withSocket(url, ["EVENT", event], (msg) => {
    if (msg[0] === "OK") {
      ok = msg[2] === true;
      return true;
    }
    return false;
  });
  return ok;
}

export async function publishToRelays(
  urls: string[],
  event: SignedEvent,
): Promise<number> {
  const results = await Promise.allSettled(
    urls.map((url) => publishRelay(url, event)),
  );
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}

// --- High-level operations ---

function extractWriteRelays(events: RelayEvent[]): string[] {
  const relays = new Set<string>();
  for (const e of events) {
    for (const t of e.tags) {
      if (
        t[0] === "r" && t[1]?.startsWith("wss://") &&
        (!t[2] || t[2] === "write")
      ) {
        relays.add(t[1].trim());
      }
    }
  }
  return [...relays];
}

export async function fetchManifest(
  ctx: NsiteContext,
): Promise<RelayEvent | null> {
  const manifestFilter = ctx.identifier
    ? { kinds: [35128], authors: [ctx.pubkey], "#d": [ctx.identifier] }
    : { kinds: [15128], authors: [ctx.pubkey], limit: 1 };

  // Query bootstrap relays for manifest AND relay list in parallel
  const [bootstrapManifests, relayEvents] = await Promise.all([
    queryRelays(BOOTSTRAP_RELAYS, manifestFilter),
    queryRelays(BOOTSTRAP_RELAYS, {
      kinds: [10002],
      authors: [ctx.pubkey],
      limit: 5,
    }),
  ]);

  // If bootstrap already found it, return immediately
  if (bootstrapManifests.length > 0) {
    return bootstrapManifests.sort((a, b) => b.created_at - a.created_at)[0];
  }

  // Otherwise try the owner's relays
  const ownerRelays = extractWriteRelays(relayEvents).filter(
    (r) => !BOOTSTRAP_RELAYS.includes(r),
  );
  if (ownerRelays.length === 0) return null;

  const events = await queryRelays(ownerRelays, manifestFilter);
  return events.sort((a, b) => b.created_at - a.created_at)[0] ?? null;
}

export async function getWriteRelays(pubkey: string): Promise<string[]> {
  const events = await queryRelays(BOOTSTRAP_RELAYS, {
    kinds: [10002],
    authors: [pubkey],
    limit: 5,
  });
  const relays = extractWriteRelays(events);
  return relays.length > 0
    ? relays
    : BOOTSTRAP_RELAYS.filter((r) => r !== "wss://purplepag.es");
}

export async function checkExistingSite(
  relays: string[],
  pubkey: string,
  slug?: string,
): Promise<boolean> {
  const filter = slug
    ? { kinds: [35128], authors: [pubkey], "#d": [slug], limit: 1 }
    : { kinds: [15128], authors: [pubkey], limit: 1 };
  const events = await queryRelays(relays, filter);
  return events.length > 0;
}

const MAX_MUSE_TAGS = 9;

export function extractMuses(event: RelayEvent): Muse[] {
  return event.tags
    .filter((t) => t[0] === "muse" && t[1] && t[2])
    .map((t) => ({
      index: parseInt(t[1], 10),
      pubkey: t[2],
      relays: t.slice(3),
    }))
    .sort((a, b) => a.index - b.index);
}

export function createDeployEvent(
  source: RelayEvent,
  options: {
    slug?: string;
    title?: string;
    description?: string;
    deployerPubkey: string;
    deployerRelays: string[];
    noTrail?: boolean;
  },
): EventTemplate {
  const tags: string[][] = [];
  if (options.slug) tags.push(["d", options.slug]);
  for (const t of source.tags) {
    if (t[0] === "path" || t[0] === "server") tags.push([...t]);
  }

  if (!options.noTrail) {
    // Paper trail: copy muse tags, add new one, enforce max 9
    const sourceMuses = source.tags
      .filter((t) => t[0] === "muse" && t[1] && t[2])
      .map((t) => [...t])
      .sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));

    const maxIndex = sourceMuses.length > 0
      ? Math.max(...sourceMuses.map((t) => parseInt(t[1], 10)))
      : -1;
    const newMuse = [
      "muse",
      String(maxIndex + 1),
      options.deployerPubkey,
      ...options.deployerRelays,
    ];
    const allMuses = [...sourceMuses, newMuse];

    // Keep index 0 (originator) + newest, FIFO truncate the middle
    if (allMuses.length > MAX_MUSE_TAGS) {
      const originator = allMuses[0];
      const keep = allMuses.slice(allMuses.length - (MAX_MUSE_TAGS - 1));
      tags.push(originator, ...keep);
    } else {
      for (const t of allMuses) tags.push(t);
    }
  }

  if (options.title) tags.push(["title", options.title]);
  if (options.description) tags.push(["description", options.description]);
  return {
    kind: options.slug ? 35128 : 15128,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
}

// --- Muse profile enrichment (streaming, non-blocking) ---

export function fetchMuseProfiles(
  muses: Muse[],
  baseDomain: string,
  onUpdate: (pubkey: string, profile: MuseProfile) => void,
): void {
  const pubkeys = [...new Set(muses.map((m) => m.pubkey))];
  if (pubkeys.length === 0) return;

  // Track best kind-0 per pubkey (highest created_at wins)
  const bestK0 = new Map<
    string,
    { created_at: number; profile: MuseProfile }
  >();
  const profileResolved = new Set<string>();

  const handleEvent = (event: RelayEvent) => {
    if (event.kind === 0) {
      const existing = bestK0.get(event.pubkey);
      if (existing && existing.created_at >= event.created_at) return;
      try {
        const meta = JSON.parse(event.content);
        const name = meta.display_name || meta.name || meta.displayName;
        if (!name) return;
        const profile: MuseProfile = { npub: npubEncode(event.pubkey), name };
        bestK0.set(event.pubkey, { created_at: event.created_at, profile });
        profileResolved.add(event.pubkey);
        onUpdate(event.pubkey, { ...profile });
      } catch { /* invalid json */ }
    }
  };

  // Stream kind 0 from profile relays — fire all in parallel, callback per event
  const subId = Math.random().toString(36).slice(2, 8);
  const filter = { kinds: [0], authors: pubkeys };

  Promise.allSettled(
    PROFILE_RELAYS.map((url) =>
      withSocket(url, ["REQ", subId, filter], (msg) => {
        if (msg[0] === "EVENT" && msg[1] === subId) {
          handleEvent(msg[2] as RelayEvent);
        }
        return msg[0] === "EOSE" && msg[1] === subId;
      })
    ),
  ).then(() => {
    // After profiles are gathered, check for nsites on bootstrap relays
    const resolved = [...profileResolved];
    if (resolved.length === 0) return;

    queryRelays(BOOTSTRAP_RELAYS, {
      kinds: [15128, 35128],
      authors: resolved,
    }).then((events) => {
      // Group by pubkey — prefer root (15128), fall back to first named (35128)
      const nsiteMap = new Map<string, string>();
      for (const e of events) {
        if (e.kind === 15128 && !nsiteMap.has(e.pubkey)) {
          nsiteMap.set(e.pubkey, buildSiteUrl(baseDomain, e.pubkey));
        }
      }
      for (const e of events) {
        if (e.kind === 35128 && !nsiteMap.has(e.pubkey)) {
          const dTag = e.tags.find((t) => t[0] === "d")?.[1];
          if (dTag) {
            nsiteMap.set(
              e.pubkey,
              buildSiteUrl(baseDomain, e.pubkey, dTag),
            );
          }
        }
      }

      for (const [pk, url] of nsiteMap) {
        const entry = bestK0.get(pk);
        if (entry) {
          entry.profile.nsiteUrl = url;
          onUpdate(pk, { ...entry.profile });
        }
      }
    });
  });
}

export function buildSiteUrl(
  baseDomain: string,
  pubkey: string,
  slug?: string,
): string {
  if (slug) {
    return `https://${pubkeyToBase36(pubkey)}${slug}.${baseDomain}`;
  }
  return `https://${npubEncode(pubkey)}.${baseDomain}`;
}

// --- Ditto theme resolution ---

export interface DittoTheme {
  accent?: string;
  background?: string;
  text?: string;
  radius?: string;
}

export async function fetchDittoTheme(naddr: string): Promise<DittoTheme | null> {
  if (!naddr) return null;
  try {
    const result = decode(naddr);
    if (result.type !== "naddr") return null;
    const { identifier, pubkey, kind, relays: naddrRelays } = result.data;

    // Build deduped relay list: naddr hints first, then bootstrap fallback
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const r of [...(naddrRelays ?? []), ...BOOTSTRAP_RELAYS]) {
      if (!seen.has(r)) { seen.add(r); urls.push(r); }
    }

    const events = await queryRelays(urls, {
      kinds: [kind],
      authors: [pubkey],
      "#d": [identifier],
      limit: 1,
    });
    if (events.length === 0) return null;

    const event = events.sort((a, b) => b.created_at - a.created_at)[0];
    const meta = JSON.parse(event.content);
    const theme: DittoTheme = {};
    if (typeof meta.accent === "string" && meta.accent) theme.accent = meta.accent;
    if (typeof meta.background === "string" && meta.background) theme.background = meta.background;
    if (typeof meta.text === "string" && meta.text) theme.text = meta.text;
    if (typeof meta.radius === "string" && meta.radius) theme.radius = meta.radius;
    return theme;
  } catch {
    return null;
  }
}
