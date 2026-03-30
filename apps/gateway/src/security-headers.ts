/**
 * Security headers for all gateway responses.
 *
 * Applied to every response including nsite content, error pages, and loading pages.
 * CSP uses unsafe-inline for script/style because nsite sites may embed inline code.
 * X-Frame-Options is SAMEORIGIN (not DENY) — DENY breaks sites embedded as iframes
 * in their own domains (e.g., docs.example.com embedding example.com content).
 *
 * Per RESEARCH.md security headers code example.
 */
export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline' blob: https:; style-src 'self' 'unsafe-inline' https:; worker-src 'self' blob:; img-src * data: blob:; media-src * data: blob:; font-src * data: https:; connect-src 'self' wss: https:; frame-src 'none'; object-src 'none'",
  };
}
