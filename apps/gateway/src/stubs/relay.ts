/**
 * Relay proxy handler.
 * Proxies WebSocket connections to the relay Edge Script.
 * Also handles NIP-11 (HTTP GET with nostr+json Accept header).
 */

let _relayUrl: string | null = null;

function getRelayUrl(): string {
  if (!_relayUrl) {
    _relayUrl = Deno.env.get("RELAY_URL") ?? "";
  }
  return _relayUrl;
}

export function handleRelay(request: Request): Response {
  const relayUrl = getRelayUrl();
  if (!relayUrl) {
    return new Response("Relay not configured", { status: 503 });
  }

  // NIP-11: HTTP GET with Accept: application/nostr+json → proxy as HTTP
  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("application/nostr+json")
  ) {
    return fetch(relayUrl, {
      headers: { Accept: "application/nostr+json" },
    }) as Promise<Response> as unknown as Response;
  }

  // WebSocket upgrade → bidirectional proxy
  // Bunny uses request.upgradeWebSocket(), not Deno.upgradeWebSocket()
  // deno-lint-ignore no-explicit-any
  const upgrade = (request as any).upgradeWebSocket();
  const client = upgrade.socket as WebSocket;
  const wsUrl = relayUrl.replace(/^http/, "ws");
  const upstream = new WebSocket(wsUrl);

  // Buffer client messages until upstream is ready
  const pendingMessages: string[] = [];

  client.onmessage = (e: MessageEvent) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(e.data as string);
    } else {
      pendingMessages.push(e.data as string);
    }
  };

  upstream.onopen = () => {
    for (const msg of pendingMessages) {
      upstream.send(msg);
    }
    pendingMessages.length = 0;
  };

  upstream.onmessage = (e: MessageEvent) => {
    if (client.readyState === WebSocket.OPEN) client.send(e.data as string);
  };

  client.onclose = () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
  };

  upstream.onclose = () => {
    if (client.readyState === WebSocket.OPEN) client.close();
  };

  upstream.onerror = () => {
    if (client.readyState === WebSocket.OPEN) client.close();
  };

  client.onerror = () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close();
  };

  return upgrade.response;
}
