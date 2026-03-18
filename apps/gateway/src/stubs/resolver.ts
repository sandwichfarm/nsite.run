/**
 * Resolver stub handler.
 * Returns 503 confirming nsite resolver routing is wired, with SitePointer details.
 * Live resolver implementation is in Phase 5.
 */
import type { SitePointer } from "../hostname.ts";

export function handleResolverStub(_request: Request, pointer: SitePointer): Response {
  return new Response(
    JSON.stringify({
      routed: "resolver",
      kind: pointer.kind,
      npub: pointer.npub,
      identifier: pointer.identifier ?? null,
      note: "nsite resolver not yet live",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" },
    },
  );
}
