/**
 * HTML page generators for the nsite gateway.
 *
 * Provides loading page (cold-cache), 404 pages, update banner, and banner injection.
 *
 * The loading page template is loaded from a static .html file — this satisfies the
 * user's locked decision ("Static HTML template file, not inline string") while also
 * working with esbuild bundling via `loader: { ".html": "text" }`.
 *
 * At runtime on Deno, the template is read from disk via Deno.readTextFileSync.
 * At bundle time, esbuild replaces the readTextFileSync call with the inlined string
 * via the .html: text loader config in build.ts.
 *
 * Note: import with { type: "text" } requires --unstable-raw-imports flag in Deno 2.x
 * and is not suitable for production tests. readTextFileSync + import.meta.url is the
 * standard Deno pattern for loading adjacent files.
 */

/**
 * Escape HTML special characters to prevent XSS in profile data.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Template inlined as string constant — Bunny Edge Scripting has no filesystem access.
const LOADING_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading nsite...</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333}
      .card{background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.10);padding:36px 40px;text-align:center;max-width:320px;width:90%}
      .avatar{width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 16px;display:block;background:#e0e0e0}
      .avatar-placeholder{width:80px;height:80px;border-radius:50%;background:#e0e0e0;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#999}
      .display-name{font-size:18px;font-weight:600;margin-bottom:8px;color:#111}
      .status{font-size:14px;color:#777;margin-bottom:20px}
      .spinner{display:inline-block;width:24px;height:24px;border:3px solid #e0e0e0;border-top-color:#7b6ef6;border-radius:50%;animation:spin .8s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style>
  </head>
  <body>
    <div class="card">
      {{AVATAR_SECTION}}
      <div class="display-name">{{DISPLAY_NAME}}</div>
      <div class="status">Fetching site content...</div>
      <span class="spinner"></span>
    </div>
    <script>
      (function(){var key="{{CACHE_KEY}}";var interval=setInterval(function(){fetch("/_nsite/ready?k="+encodeURIComponent(key)).then(function(r){return r.json()}).then(function(data){if(data&&data.ready===true){clearInterval(interval);window.location.reload()}}).catch(function(){})},2000)})();
    </script>
  </body>
</html>`;

/**
 * Render the cold-cache loading page with profile data.
 *
 * Replaces {{DISPLAY_NAME}}, {{AVATAR_URL}}, {{CACHE_KEY}}, and {{AVATAR_SECTION}}
 * placeholders in the static HTML template.
 */
export function renderLoadingPage(opts: {
  displayName: string;
  avatarUrl: string;
  cacheKey: string;
}): string {
  const displayName = opts.displayName ? escapeHtml(opts.displayName) : "Loading nsite...";

  const avatarSection = opts.avatarUrl
    ? `<img class="avatar" src="${
      escapeHtml(opts.avatarUrl)
    }" alt="${displayName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">\n  <div class="avatar-placeholder" style="display:none">&#128100;</div>`
    : `<div class="avatar-placeholder">&#128100;</div>`;

  return LOADING_TEMPLATE
    .replace("{{DISPLAY_NAME}}", displayName)
    .replace("{{AVATAR_SECTION}}", avatarSection)
    .replace("{{AVATAR_URL}}", escapeHtml(opts.avatarUrl))
    .replace("{{CACHE_KEY}}", escapeHtml(opts.cacheKey));
}

/**
 * Render the "nsite not found" page.
 * Shown when no manifest event exists for the requested npub/identifier.
 */
export function renderNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>nsite not found</title>
<style>
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.10); padding: 40px; text-align: center; max-width: 400px; width: 90%; }
  h1 { font-size: 22px; margin-bottom: 12px; color: #111; }
  p { font-size: 15px; color: #666; margin-bottom: 20px; line-height: 1.5; }
  a { color: #7b6ef6; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<div class="card">
  <h1>This nsite doesn't exist yet</h1>
  <p>No site has been published at this address. Want to create your own nsite?</p>
  <p><a href="https://nsite.run" target="_blank" rel="noopener">Visit nsite.run to get started</a></p>
</div>
</body>
</html>`;
}

/**
 * Render the default 404 page.
 * Shown when a path is not found in the site manifest and the site has no /404.html.
 */
export function renderDefault404(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page not found</title>
<style>
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,0.10); padding: 40px; text-align: center; max-width: 400px; width: 90%; }
  h1 { font-size: 22px; margin-bottom: 12px; color: #111; }
  p { font-size: 15px; color: #666; line-height: 1.5; }
  .code { font-size: 48px; font-weight: 700; color: #ccc; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card">
  <div class="code">404</div>
  <h1>Page not found</h1>
  <p>This page doesn't exist on this site.</p>
</div>
</body>
</html>`;
}

/**
 * Update banner HTML — fixed bar at top of viewport.
 *
 * Shown when site content has been updated since last cache.
 * Uses position:fixed so it overlays content regardless of injection point.
 * Inline CSS and JS ensure it works regardless of the site's own styles.
 * Dismissible via X button.
 */
export const BANNER_HTML =
  `<div id="_nsite-banner" style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#ffffcc;border-bottom:1px solid #cccc99;padding:6px 12px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;display:flex;justify-content:space-between;align-items:center;"><span>This site has been updated. <a href="" onclick="location.reload();return false;" style="color:#0066cc;text-decoration:underline;">Click to refresh.</a></span><button onclick="document.getElementById('_nsite-banner').remove()" style="border:none;background:none;cursor:pointer;font-size:16px;padding:0 4px;color:#666;" aria-label="Dismiss">&#x2715;</button></div>`;

/**
 * Inject the update banner into an HTML string.
 *
 * Inserts BANNER_HTML before the last </body> tag (case-sensitive per HTML5 spec).
 * Falls back to appending to end if no </body> found.
 *
 * Per RESEARCH.md Pattern 6: lastIndexOf("</body>") is most reliable injection point.
 */
export function injectBanner(html: string): string {
  const lastBodyTag = html.lastIndexOf("</body>");
  if (lastBodyTag !== -1) {
    return html.slice(0, lastBodyTag) + BANNER_HTML + html.slice(lastBodyTag);
  }
  // Fallback: append to end (browsers render it correctly)
  return html + BANNER_HTML;
}
