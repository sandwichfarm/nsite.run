/**
 * SPA handler.
 * Serves the nsite SPA from Bunny CDN Storage.
 *
 * If SPA_ASSETS_URL is configured, proxies requests to the CDN.
 * Falls back to a graceful "not yet deployed" HTML page otherwise.
 *
 * Handles SPA client-side routing: if the CDN returns 404 for a path,
 * serves index.html instead (allows React Router / SvelteKit navigation).
 */
export async function handleSpa(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const spaAssetsUrl = Deno.env.get("SPA_ASSETS_URL")?.replace(/\/$/, "");

  // Normalize pathname: default '/' to '/index.html'
  let pathname = url.pathname;
  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  if (!spaAssetsUrl) {
    // Graceful degradation when SPA not yet deployed
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>nsite.run</title></head>
<body>
<h1>nsite.run</h1>
<p>SPA not yet deployed. Set SPA_ASSETS_URL to enable.</p>
</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
    );
  }

  // Fetch from CDN storage
  try {
    const assetUrl = `${spaAssetsUrl}${pathname}`;
    let cdnResponse = await fetch(assetUrl);

    // SPA fallback: if CDN returns 404 for a non-root path, serve index.html
    if (cdnResponse.status === 404 && pathname !== "/index.html") {
      const indexUrl = `${spaAssetsUrl}/index.html`;
      cdnResponse = await fetch(indexUrl);
    }

    if (!cdnResponse.ok) {
      return new Response(
        `SPA unavailable (CDN returned ${cdnResponse.status}). SPA_ASSETS_URL: ${spaAssetsUrl}`,
        {
          status: 502,
          headers: {
            "Content-Type": "text/plain",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "SAMEORIGIN",
          },
        },
      );
    }

    // Determine cache-control based on asset type
    const isHtml = pathname === "/index.html" ||
      pathname.endsWith(".html");
    const cacheControl = isHtml ? "no-cache" : "public, max-age=3600";

    const contentType = cdnResponse.headers.get("Content-Type") ??
      "application/octet-stream";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    };

    return new Response(cdnResponse.body, {
      status: cdnResponse.status,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      `SPA fetch error: ${msg}\nSPA_ASSETS_URL: ${spaAssetsUrl}`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/plain",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "SAMEORIGIN",
        },
      },
    );
  }
}
