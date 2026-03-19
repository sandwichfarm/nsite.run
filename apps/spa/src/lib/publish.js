/**
 * Builds a kind 15128 site manifest event template (unsigned).
 *
 * @param {{ path: string, sha256: string }[]} files - List of files with path and sha256
 * @param {string[]} servers - Blossom server URLs for server hints
 * @param {boolean} spaFallback - If true and /index.html exists, adds /404.html path tag
 * @returns {{ kind: number, created_at: number, tags: string[][], content: string }}
 */
export function buildManifest(files, servers, spaFallback) {
  const pathTags = files.map((f) => ['path', f.path, f.sha256]);

  // SPA fallback: add /404.html pointing to index.html's sha256
  if (spaFallback) {
    const indexFile = files.find((f) => f.path === '/index.html');
    if (indexFile) {
      pathTags.push(['path', '/404.html', indexFile.sha256]);
    }
  }

  const serverTags = servers.map((url) => ['server', url]);

  return {
    kind: 15128,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...pathTags, ...serverTags, ['client', 'nsite.run']],
    content: '',
  };
}

/**
 * Publishes a signed Nostr event to a relay via WebSocket.
 * Sends ['EVENT', signedEvent] and waits for an ['OK', eventId, true/false] response.
 * Times out after 10 seconds.
 *
 * @param {object} signedEvent - A fully signed Nostr event (with id, sig, pubkey)
 * @param {string} relayUrl - WebSocket URL of the relay
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export function publishToRelay(signedEvent, relayUrl) {
  return new Promise((resolve) => {
    let ws;
    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };

    const timer = setTimeout(() => {
      settle({ success: false, message: 'Timeout: no OK response within 10 seconds' });
    }, 10000);

    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      clearTimeout(timer);
      resolve({ success: false, message: err?.message ?? String(err) });
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify(['EVENT', signedEvent]));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!Array.isArray(msg)) return;
        if (msg[0] === 'OK' && msg[1] === signedEvent.id) {
          settle({ success: !!msg[2], message: msg[3] ?? undefined });
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => {
      settle({ success: false, message: 'WebSocket connection error' });
    };
  });
}

/**
 * Builds a manifest, signs it, and publishes it to each relay.
 *
 * @param {{ signEvent: (template: object) => Promise<object> }} signer
 * @param {{ path: string, sha256: string }[]} files
 * @param {string[]} servers - Blossom server URLs
 * @param {string[]} relays - Relay WebSocket URLs to publish to
 * @param {boolean} spaFallback
 * @returns {Promise<{ event: object, results: { relay: string, success: boolean, message?: string }[] }>}
 */
/**
 * Publishes manifest + relay list to all configured relays.
 * Returns detailed per-relay results. Throws if manifest accepted by zero relays.
 *
 * Success model (matches nsyte):
 * - Manifest accepted by ≥1 relay = success (partial relay failures are warnings, not errors)
 * - Manifest accepted by 0 relays = failure (throw with rejection messages)
 */
export async function publishManifest(signer, files, servers, relays, spaFallback) {
  const template = buildManifest(files, servers, spaFallback);
  const event = await signer.signEvent(template);

  // Also publish a kind 10002 relay list so the resolver can discover this user's relays.
  // Critical for anonymous deploys where no relay list exists yet.
  const relayListTemplate = {
    kind: 10002,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...relays.map(r => ['r', r]), ['client', 'nsite.run']],
    content: '',
  };
  const relayListEvent = await signer.signEvent(relayListTemplate);

  const results = [];
  for (const relay of relays) {
    // Publish relay list first, then manifest
    const rlResult = await publishToRelay(relayListEvent, relay).catch(() => ({ success: false, message: 'connection failed' }));

    const result = await publishToRelay(event, relay).catch(() => ({ success: false, message: 'connection failed' }));
    results.push({
      relay,
      ...result,
      relayListAccepted: rlResult.success,
    });
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  // Manifest accepted by zero relays = deploy failed
  if (successCount === 0) {
    const msgs = results.map(r => `${r.relay}: ${r.message ?? 'rejected'}`).join('\n');
    throw new Error(`Manifest rejected by all ${failureCount} relay(s):\n${msgs}`);
  }

  return { event, results, successCount, failureCount };
}
