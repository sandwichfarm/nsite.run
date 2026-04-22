import { decode, npubEncode } from "nostr-tools/nip19";
import type { EventTemplate, SignedEvent } from "./signer";

export type { EventTemplate, SignedEvent };

/**
 * Parsed nsite context derived from the current hostname: the owner's pubkey,
 * the optional slug (d-tag) for named sub-sites, and the base domain for URL
 * construction. `null` when the hostname does not match either an `npub1…`
 * subdomain or a base36-encoded named-site label.
 */
export interface NsiteContext {
  pubkey: string;
  identifier?: string;
  baseDomain: string;
}

/**
 * A single step in an nsite's "paper trail" — one previous deployer identified
 * by pubkey, their position in the chain (`index`), and their write relays.
 */
export interface Muse {
  index: number;
  pubkey: string;
  relays: string[];
}

/**
 * Progressive-enrichment metadata for a {@link Muse}: their npub, their
 * display name from kind-0 if resolved, and a URL to their own nsite if one
 * is discoverable on bootstrap relays.
 */
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

/** Encode a hex pubkey as its 50-character base36 representation (the named-site label prefix). */
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

/** Encode a hex pubkey into its NIP-19 npub form. Thin re-export of `nostr-tools/nip19`. */
export { npubEncode };

// --- Context ---

/**
 * Parse the current `window.location.hostname` into an {@link NsiteContext},
 * supporting both `npub1…` subdomain form and base36-encoded named-site labels.
 * Returns `null` if the hostname does not match either pattern.
 */
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

/** Return `true` if `s` is a valid d-tag for a named nsite (1-13 chars, lowercase a-z/0-9/hyphen, not trailing hyphen). */
export function isValidDTag(s: string): boolean {
  return D_TAG_RE.test(s) && !s.endsWith("-");
}

// --- Relay communication ---

/**
 * A Nostr relay event as returned from WebSocket queries — the raw event shape
 * with `id` and `sig` already present (distinct from `EventTemplate` which is
 * pre-signing, and from `SignedEvent` which is structurally compatible but
 * used by the signer API). This interface is re-exported so that consumers
 * (and the type-graph) can reason about `fetchManifest`'s return value and
 * the parameters of `extractMuses` / `createDeployEvent`.
 */
export interface RelayEvent {
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

/**
 * Publish a signed Nostr event to an array of relay URLs in parallel. Resolves
 * with the count of relays that accepted the event (`OK` response with `true`).
 *
 * @param urls - Array of `wss://` relay URLs.
 * @param event - A fully-signed Nostr event ready for `EVENT` frame transmission.
 * @returns The number of relays that responded with a successful `OK` within the per-relay 5-second timeout.
 */
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

/**
 * Fetch the nsite manifest (kind 15128 for root sites, kind 35128 for named
 * sites) for the given {@link NsiteContext} — tries bootstrap relays first,
 * then falls back to the owner's NIP-65 write relays if the manifest is not
 * found on bootstrap.
 *
 * @returns The most-recent matching manifest event, or `null` if none is found on any tried relay.
 */
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

/**
 * Fetch the given pubkey's NIP-65 (kind 10002) relay list from bootstrap relays
 * and return the subset marked as write-capable. Falls back to `[relay.damus.io,
 * nos.lol]` if no list is found so callers always have a non-empty array.
 */
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

/**
 * Query the given relays for an existing nsite manifest owned by `pubkey`.
 * With `slug`, checks for a named-site (kind 35128 with matching `d` tag);
 * without, checks for a root site (kind 15128). Returns `true` if found.
 */
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

/**
 * Extract the `muse` tags from a {@link RelayEvent} into a sorted array of
 * {@link Muse} records (sorted ascending by `index`). Filters out malformed
 * tags (missing index or pubkey).
 */
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

/**
 * Build an unsigned deploy event (kind 15128 for root, kind 35128 for named)
 * from a source manifest — copies `path` and `server` tags, optionally appends
 * the caller as a new `muse` tag while enforcing the 9-tag max (originator
 * preserved, middle entries FIFO-truncated), and attaches title/description.
 *
 * @param source - The source manifest event being re-published.
 * @param options - Deploy options (slug, title, description, deployer identity, trail toggle).
 */
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

/**
 * Stream kind-0 profile events and nsite manifests for each unique pubkey in
 * `muses`, invoking `onUpdate` progressively as profile names and nsite URLs
 * are discovered. Non-blocking — the returned `void` is immediate; enrichment
 * happens asynchronously in the background.
 *
 * @param muses - The paper-trail entries whose profiles should be enriched.
 * @param baseDomain - Used to construct nsite URLs when a deployer's manifest is found.
 * @param onUpdate - Called once per resolved piece of profile data (name first, then nsiteUrl if found).
 */
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

/**
 * Construct the canonical public URL for an nsite: `https://<npub>.<baseDomain>`
 * for root sites, or `https://<base36pubkey><slug>.<baseDomain>` for named sites.
 */
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

/**
 * One font in a Ditto theme — family, URL for @font-face, and role (body or title).
 */
export interface DittoThemeFont {
  family: string;
  url: string;
  role: "body" | "title";
}

/**
 * Background-image metadata from a Ditto theme — URL, display mode (cover or
 * tile), MIME type, plus optional dimension hint and blurhash placeholder.
 */
export interface DittoThemeBg {
  url: string;
  mode: "cover" | "tile";
  mime: string;
  dim?: string;
  blurhash?: string;
}

/**
 * A fully-resolved Ditto theme (kind 36767 or kind 16767) — colors, fonts,
 * optional background, and the originating {@link RelayEvent} for traceability.
 */
export interface DittoTheme {
  title?: string;
  colors: { primary: string; background: string; text: string };
  fonts: DittoThemeFont[];
  bg?: DittoThemeBg;
  event: RelayEvent;
}

/**
 * Resolve a Ditto theme from a Nostr `naddr` — decodes the NIP-19 address,
 * fetches the referenced event from naddr-hint and bootstrap relays, parses
 * its `c`/`f`/`bg`/`title` tags, and returns a {@link DittoTheme}. Returns
 * `null` if the naddr is malformed, references a non-theme kind, or cannot
 * be fetched from any relay.
 */
export async function fetchDittoTheme(naddr: string): Promise<DittoTheme | null> {
  if (!naddr) return null;
  try {
    const result = decode(naddr);
    if (result.type !== "naddr") return null;
    const { identifier, pubkey, kind, relays: naddrRelays } = result.data;
    if (kind !== 36767 && kind !== 16767) return null;

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

    // Colors: c tags — ["c", "#rrggbb", "primary"|"text"|"background"]
    let primary: string | undefined;
    let background: string | undefined;
    let text: string | undefined;
    // Fonts: f tags — ["f", "family", "url", "role"]
    const fonts: DittoThemeFont[] = [];
    // Background: bg tag — ["bg", "url <url>", "mode <mode>", "m <mime>", ...]
    let bg: DittoThemeBg | undefined;
    // Title: title tag
    let title: string | undefined;

    for (const tag of event.tags) {
      if (tag[0] === "c" && tag[1] && tag[2]) {
        if (tag[2] === "primary") primary = tag[1];
        else if (tag[2] === "background") background = tag[1];
        else if (tag[2] === "text") text = tag[1];
      } else if (tag[0] === "f" && tag[1] && tag[2]) {
        const role = (tag[3] || "body") as "body" | "title";
        if (role === "body" || role === "title") {
          fonts.push({ family: tag[1], url: tag[2], role });
        }
      } else if (tag[0] === "bg") {
        // Imeta-style variadic: each element after index 0 is "key value"
        const kv: Record<string, string> = {};
        for (let i = 1; i < tag.length; i++) {
          const space = tag[i].indexOf(" ");
          if (space > 0) kv[tag[i].slice(0, space)] = tag[i].slice(space + 1);
        }
        if (kv.url && kv.mode && kv.m) {
          bg = {
            url: kv.url,
            mode: kv.mode as "cover" | "tile",
            mime: kv.m,
            dim: kv.dim,
            blurhash: kv.blurhash,
          };
        }
      } else if (tag[0] === "title" && tag[1]) {
        title = tag[1];
      }
    }

    if (!primary || !background || !text) return null;
    return {
      title,
      colors: { primary, background, text },
      fonts,
      bg,
      event,
    };
  } catch {
    return null;
  }
}

/**
 * Build an unsigned kind-16767 active-theme event from a resolved
 * {@link DittoTheme} — ready for signing and publishing to the user's write
 * relays to set (or replace) their Ditto profile theme.
 */
export function createActiveThemeEvent(theme: DittoTheme): EventTemplate {
  const tags: string[][] = [];
  // Colors (required)
  tags.push(["c", theme.colors.primary, "primary"]);
  tags.push(["c", theme.colors.text, "text"]);
  tags.push(["c", theme.colors.background, "background"]);
  // Fonts (optional, preserve order: body before title)
  const bodyFont = theme.fonts.find((f) => f.role === "body");
  const titleFont = theme.fonts.find((f) => f.role === "title");
  if (bodyFont) tags.push(["f", bodyFont.family, bodyFont.url, "body"]);
  if (titleFont) tags.push(["f", titleFont.family, titleFont.url, "title"]);
  // Background (optional)
  if (theme.bg) {
    const parts = [`url ${theme.bg.url}`, `mode ${theme.bg.mode}`, `m ${theme.bg.mime}`];
    if (theme.bg.dim) parts.push(`dim ${theme.bg.dim}`);
    if (theme.bg.blurhash) parts.push(`blurhash ${theme.bg.blurhash}`);
    tags.push(["bg", ...parts]);
  }
  // Title (optional)
  if (theme.title) tags.push(["title", theme.title]);
  // Alt (required per NIP-31)
  tags.push(["alt", "Active profile theme"]);
  return {
    kind: 16767,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  };
}

/**
 * Return `true` if the given `pubkey` already has an active (kind-16767)
 * Ditto theme event published on any of the specified relays.
 */
export async function checkExistingTheme(
  relays: string[],
  pubkey: string,
): Promise<boolean> {
  const events = await queryRelays(relays, {
    kinds: [16767],
    authors: [pubkey],
    limit: 1,
  });
  return events.length > 0;
}
