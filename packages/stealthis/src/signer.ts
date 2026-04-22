import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
  BunkerSigner as NtBunkerSigner,
  parseBunkerInput,
  createNostrConnectURI
} from 'nostr-tools/nip46';

/**
 * An unsigned Nostr event — the input shape passed to a signer to produce a
 * {@link SignedEvent}. Mirrors the subset of Nostr event fields that consumers
 * are expected to populate; `id`, `pubkey`, and `sig` are derived by the signer.
 */
export interface EventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

/**
 * A fully-signed Nostr event — {@link EventTemplate} plus the signer-computed
 * `id`, `pubkey`, and `sig`. Ready for publication to a relay via `EVENT` frame.
 */
export interface SignedEvent extends EventTemplate {
  id: string;
  pubkey: string;
  sig: string;
}

/**
 * A unified signer interface covering NIP-07 browser extensions, NIP-46 bunker
 * connections, and the returned handle from {@link prepareNostrConnect}.
 * Consumers call `getPublicKey()` once, then `signEvent(template)` per event;
 * when done, `close()` releases any underlying WebSocket or session state.
 */
export interface Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
  close(): void;
}

/**
 * Handle returned by `prepareNostrConnect` — a pair of (QR-encodable URI, awaitable signer promise).
 * Consumers render the `uri` as a QR code / bunker URI and await `connect(abortSignal)` in the
 * background; when the remote signer scans the QR and authorises, the returned `Signer`
 * resolves. Pass an `AbortSignal` to cancel the await (widget.ts does this via its
 * `qrAbort: AbortController` field when the modal is closed).
 */
export interface NostrConnectHandle {
  /** The `nostrconnect://` URI to render as a QR code / copy-to-clipboard string. */
  uri: string;
  /**
   * Await the remote signer connection. Resolves when the user's signer app
   * completes the NIP-46 handshake. Reject via `abort.abort()` from caller.
   *
   * @param abort - Optional AbortSignal; if omitted, a 300_000ms (5 min) timeout is used instead.
   */
  connect(abort?: AbortSignal): Promise<Signer>;
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: EventTemplate): Promise<SignedEvent>;
    };
  }
}

/**
 * The default NIP-46 nostrconnect relay used when the widget has no user-provided
 * `wss://` URL. Set to `wss://bucket.coracle.social`, which operates a public
 * nostrconnect rendezvous channel; consumers may override per-widget via the
 * `relay` input shown in the auth UI.
 */
export const DEFAULT_NIP46_RELAY = 'wss://bucket.coracle.social';

/** Return `true` if a NIP-07 browser-extension signer is available on `window.nostr`. */
export function hasExtension(): boolean {
  return !!window.nostr;
}

/**
 * Wrap the NIP-07 `window.nostr` extension as a {@link Signer}. Throws if no
 * extension is installed — call {@link hasExtension} first to probe availability.
 */
export function extensionSigner(): Signer {
  if (!window.nostr) throw new Error('No Nostr signer extension found');
  const ext = window.nostr;
  return {
    getPublicKey: () => ext.getPublicKey(),
    signEvent: (e) => ext.signEvent(e),
    close() {}
  };
}

/**
 * Parse a `bunker://…` URI and establish a NIP-46 connection to the remote
 * signer. The returned {@link Signer} delegates `getPublicKey` and `signEvent`
 * over WebSocket to the bunker; `close()` terminates the session.
 *
 * @param input - A `bunker://` URI string as emitted by a NIP-46-compatible signer app.
 * @throws Error when the URI is malformed or the bunker fails to respond.
 */
export async function bunkerConnect(input: string): Promise<Signer> {
  const sk = generateSecretKey();
  const bp = await parseBunkerInput(input);
  if (!bp) throw new Error('Invalid bunker URI');
  const signer = NtBunkerSigner.fromBunker(sk, bp);
  await signer.connect();
  return wrap(signer);
}

/**
 * Build a `nostrconnect://…` URI for the client-initiated NIP-46 handshake and
 * return a {@link NostrConnectHandle} the caller can render as a QR code AND
 * simultaneously await — when the remote signer app completes the handshake,
 * the handle's `connect(abort)` promise resolves with a {@link Signer}.
 *
 * @param relay - The `wss://` NIP-46 rendezvous relay (e.g. {@link DEFAULT_NIP46_RELAY}).
 * @returns A handle exposing the QR-encodable `uri` string and an awaitable `connect` method.
 */
export function prepareNostrConnect(relay: string): NostrConnectHandle {
  const sk = generateSecretKey();
  const clientPubkey = getPublicKey(sk);
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');

  const uri = createNostrConnectURI({
    clientPubkey,
    relays: [relay],
    secret,
    name: 'nsite deploy'
  });

  return {
    uri,
    async connect(abort?: AbortSignal): Promise<Signer> {
      const signer = await NtBunkerSigner.fromURI(sk, uri, {}, abort ?? 300_000);
      return wrap(signer);
    }
  };
}

function wrap(signer: NtBunkerSigner): Signer {
  return {
    getPublicKey: () => signer.getPublicKey(),
    signEvent: (e) => signer.signEvent(e) as Promise<SignedEvent>,
    close: () => signer.close()
  };
}
