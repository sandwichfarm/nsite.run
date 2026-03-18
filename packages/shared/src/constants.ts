/** Nostr event kinds accepted by the nsite relay and blossom.
 * Kind 5 is NIP-09 deletion — accepted so pubkey owners can remove their own events. */
export const ALLOWED_KINDS: readonly number[] = [5, 15128, 35128, 10002, 10063];

/** Hard limit for edge script bundle size (1MB) */
export const BUNDLE_SIZE_LIMIT = 1_000_000;

/** Soft warning threshold for edge script bundle size (750KB) */
export const BUNDLE_SIZE_WARN = 750_000;
