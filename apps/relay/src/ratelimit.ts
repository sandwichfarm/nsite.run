import type { RateLimitBucket } from "./types.ts";

/** Max EVENT messages allowed per connection per minute */
const MAX_EVENTS_PER_MINUTE = 100;

/** Max REQ messages allowed per connection per minute */
const MAX_REQS_PER_MINUTE = 20;

/** Window duration in milliseconds */
const WINDOW_MS = 60_000;

/** Create a new, empty rate limit bucket for a fresh connection. */
export function createRateLimitBucket(): RateLimitBucket {
  return {
    eventCount: 0,
    reqCount: 0,
    windowStart: Date.now(),
  };
}

/** Check whether a message of the given type is within rate limits.
 *
 * Returns true if the message is allowed, false if rate-limited.
 * Resets the window when 60 seconds have elapsed since windowStart.
 * Mutates the bucket in place. */
export function checkRateLimit(
  bucket: RateLimitBucket,
  type: "event" | "req",
): boolean {
  const now = Date.now();

  // Reset window if 60 seconds have elapsed
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.eventCount = 0;
    bucket.reqCount = 0;
    bucket.windowStart = now;
  }

  if (type === "event") {
    if (bucket.eventCount >= MAX_EVENTS_PER_MINUTE) {
      return false;
    }
    bucket.eventCount++;
    return true;
  }

  // type === "req"
  if (bucket.reqCount >= MAX_REQS_PER_MINUTE) {
    return false;
  }
  bucket.reqCount++;
  return true;
}
