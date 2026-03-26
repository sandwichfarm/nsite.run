import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import {
  BunkerSigner as NtBunkerSigner,
  parseBunkerInput,
  createNostrConnectURI
} from 'nostr-tools/nip46';

export interface EventTemplate {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface SignedEvent extends EventTemplate {
  id: string;
  pubkey: string;
  sig: string;
}

export interface Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<SignedEvent>;
  close(): void;
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: EventTemplate): Promise<SignedEvent>;
    };
  }
}

export const DEFAULT_NIP46_RELAY = 'wss://bucket.coracle.social';

export function hasExtension(): boolean {
  return !!window.nostr;
}

export function extensionSigner(): Signer {
  if (!window.nostr) throw new Error('No Nostr signer extension found');
  const ext = window.nostr;
  return {
    getPublicKey: () => ext.getPublicKey(),
    signEvent: (e) => ext.signEvent(e),
    close() {}
  };
}

export async function bunkerConnect(input: string): Promise<Signer> {
  const sk = generateSecretKey();
  const bp = await parseBunkerInput(input);
  if (!bp) throw new Error('Invalid bunker URI');
  const signer = NtBunkerSigner.fromBunker(sk, bp);
  await signer.connect();
  return wrap(signer);
}

export function prepareNostrConnect(relay: string) {
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
