import { assert } from "@std/assert";
import {
  BANNER_HTML,
  injectBanner,
  renderDefault404,
  renderLoadingPage,
  renderNotFoundPage,
} from "./pages.ts";

Deno.test("renderLoadingPage - contains display name", () => {
  const html = renderLoadingPage({
    displayName: "Alice",
    avatarUrl: "https://example.com/a.png",
    cacheKey: "abc123",
  });
  assert(html.includes("Alice"));
});

Deno.test("renderLoadingPage - contains avatar URL", () => {
  const html = renderLoadingPage({
    displayName: "Alice",
    avatarUrl: "https://example.com/a.png",
    cacheKey: "abc123",
  });
  assert(html.includes("https://example.com/a.png"));
});

Deno.test("renderLoadingPage - contains cache key in polling script", () => {
  const html = renderLoadingPage({
    displayName: "Alice",
    avatarUrl: "https://example.com/a.png",
    cacheKey: "abc123",
  });
  assert(html.includes("abc123"));
});

Deno.test("renderLoadingPage - empty displayName uses fallback text", () => {
  const html = renderLoadingPage({
    displayName: "",
    avatarUrl: "",
    cacheKey: "xyz",
  });
  assert(html.includes("Loading nsite..."));
});

Deno.test("renderNotFoundPage - contains nsite doesn't exist message", () => {
  const html = renderNotFoundPage();
  assert(
    html.toLowerCase().includes("doesn't exist yet") ||
      html.toLowerCase().includes("does not exist yet"),
  );
});

Deno.test("renderNotFoundPage - contains link to nsite.run", () => {
  const html = renderNotFoundPage();
  assert(html.includes("nsite.run"));
});

Deno.test("renderDefault404 - contains page not found", () => {
  const html = renderDefault404();
  assert(html.toLowerCase().includes("page not found") || html.toLowerCase().includes("not found"));
});

Deno.test("BANNER_HTML - contains 'has been updated' message", () => {
  assert(BANNER_HTML.includes("has been updated") || BANNER_HTML.includes("been updated"));
});

Deno.test("BANNER_HTML - contains click to refresh", () => {
  assert(
    BANNER_HTML.toLowerCase().includes("click to refresh") ||
      BANNER_HTML.includes("location.reload"),
  );
});

Deno.test("BANNER_HTML - contains dismissible X button", () => {
  assert(
    BANNER_HTML.includes("✕") || BANNER_HTML.includes("&times;") || BANNER_HTML.includes("×") ||
      BANNER_HTML.includes("close") || BANNER_HTML.includes("remove()"),
  );
});

Deno.test("injectBanner - inserts banner before </body>", () => {
  const input = "<html><body><p>hi</p></body></html>";
  const result = injectBanner(input);
  const bannerPos = result.indexOf(BANNER_HTML);
  const bodyClosePos = result.lastIndexOf("</body>");
  assert(bannerPos !== -1);
  assert(bannerPos < bodyClosePos);
});

Deno.test("injectBanner - appends to end when no </body> tag", () => {
  const input = "<html><p>no body tag</p></html>";
  const result = injectBanner(input);
  assert(result.endsWith(BANNER_HTML));
});

Deno.test("injectBanner - result contains original content", () => {
  const input = "<html><body><p>content</p></body></html>";
  const result = injectBanner(input);
  assert(result.includes("<p>content</p>"));
});
