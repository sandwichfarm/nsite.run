import { ALLOWED_KINDS } from "@nsite/shared/constants";

/** NIP-11 relay information document.
 * Reference: https://github.com/nostr-protocol/nips/blob/master/11.md */
interface Nip11Document {
  name: string;
  description: string;
  // TODO: Replace PLACEHOLDER_NPUB with the operator's actual npub before deploy
  pubkey: string;
  contact: string;
  supported_nips: number[];
  software: string;
  version: string;
  limitation: {
    max_message_length: number;
    max_subscriptions: number;
    max_filters: number;
    max_limit: number;
    max_event_tags: number;
    max_content_length: number;
  };
  supported_kinds: number[];
  relay_countries: string[];
  language_tags: string[];
  tags: string[];
  posting_policy: string;
  payments_url: string;
  fees: Record<string, never>;
  icon: string;
}

/** Build a NIP-11 relay information document response.
 *
 * Returns a Response with Content-Type: application/nostr+json and CORS headers.
 * Supported kinds are sourced from ALLOWED_KINDS to stay in sync with relay enforcement. */
export function buildNip11Response(): Response {
  const doc: Nip11Document = {
    name: "nsite.run relay",
    description: "nsite-only relay for kind 15128/35128/10002/10063 events",
    // TODO: Replace with operator's actual npub before deploying to production
    pubkey: "PLACEHOLDER_NPUB",
    contact: "mailto:operator@nsite.run",
    supported_nips: [1, 9, 11, 33],
    software: "https://github.com/sandwichfarm/nsite.run",
    version: "0.1.0",
    limitation: {
      max_message_length: 65536, // 64KB per WebSocket message
      max_subscriptions: 20,
      max_filters: 10,
      max_limit: 500,
      max_event_tags: 2500,
      max_content_length: 32768, // 32KB for event content
    },
    // Sourced from ALLOWED_KINDS to stay in sync with relay kind enforcement
    supported_kinds: [...ALLOWED_KINDS].sort((a, b) => a - b),
    relay_countries: [],
    language_tags: [],
    tags: ["nsite"],
    posting_policy: "",
    payments_url: "",
    fees: {},
    icon: "",
  };

  return new Response(JSON.stringify(doc), {
    status: 200,
    headers: {
      "Content-Type": "application/nostr+json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
