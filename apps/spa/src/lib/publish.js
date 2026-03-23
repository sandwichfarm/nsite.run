/**
 * Builds a site manifest event template (unsigned).
 *
 * Supports both root sites (kind 15128) and named sites (kind 35128 with dTag).
 *
 * @param {{ path: string, sha256: string }[]} files - List of files with path and sha256
 * @param {string[]} servers - Blossom server URLs for server hints
 * @param {boolean | { spaFallback?: boolean, kind?: number, dTag?: string, title?: string, description?: string }} options
 *   - If boolean (legacy), treated as `{ spaFallback: options }` for backward compatibility.
 *   - spaFallback: If true and /index.html exists, adds /404.html path tag
 *   - kind: Event kind, defaults to 15128. Use 35128 for named sites.
 *   - dTag: Named site identifier. When provided, adds ['d', dTag] tag.
 *   - title: Site title. When non-empty, adds ['title', title] tag.
 *   - description: Site description. When non-empty, adds ['description', description] tag.
 * @returns {{ kind: number, created_at: number, tags: string[][], content: string }}
 */
export function buildManifest(files, servers, options) {
  // Backward compat: if options is a boolean, treat it as { spaFallback: options }
  const opts = typeof options === 'boolean' ? { spaFallback: options } : (options ?? {});
  const { spaFallback = false, kind = 15128, dTag, title, description } = opts;

  const pathTags = files.map((f) => ['path', f.path, f.sha256]);

  // SPA fallback: add /404.html pointing to index.html's sha256
  if (spaFallback) {
    const indexFile = files.find((f) => f.path === '/index.html');
    if (indexFile) {
      pathTags.push(['path', '/404.html', indexFile.sha256]);
    }
  }

  const serverTags = servers.map((url) => ['server', url]);

  // Optional metadata tags
  const metaTags = [];
  if (dTag) {
    metaTags.push(['d', dTag]);
  }
  if (title) {
    metaTags.push(['title', title]);
  }
  if (description) {
    metaTags.push(['description', description]);
  }

  return {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...pathTags, ...serverTags, ...metaTags, ['client', 'nsite.run']],
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
 * @param {boolean | { spaFallback?: boolean, kind?: number, dTag?: string, title?: string, description?: string }} options
 *   - Passed through to buildManifest. See buildManifest for full options documentation.
 *   - If boolean (legacy), treated as { spaFallback: options } for backward compatibility.
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
export async function publishManifest(signer, files, servers, relays, options) {
  const template = buildManifest(files, servers, options);
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

/**
 * Publishes an empty manifest to all relays, effectively "unpublishing" the site.
 * Uses replaceable event semantics — the empty manifest supersedes any previous manifest.
 *
 * For root sites (default): publishes kind 15128 with no path tags.
 * For named sites: pass options.dTag to publish kind 35128 with ['d', dTag] tag.
 *
 * @param {{ signEvent: (template: object) => Promise<object> }} signer
 * @param {string[]} relays - Relay WebSocket URLs
 * @param {{ dTag?: string }} [options] - Optional. When dTag provided, publishes kind 35128 for named site deletion.
 * @returns {Promise<{ event: object, results: { relay: string, success: boolean, message?: string }[] }>}
 */
export async function publishEmptyManifest(signer, relays, options) {
  const { dTag } = options ?? {};
  const kind = dTag ? 35128 : 15128;

  const tags = [['client', 'nsite.run']];
  if (dTag) {
    tags.unshift(['d', dTag]);
  }

  const template = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  };
  const event = await signer.signEvent(template);

  const results = [];
  for (const relay of relays) {
    const result = await publishToRelay(event, relay).catch(() => ({
      success: false,
      message: 'connection failed',
    }));
    results.push({ relay, ...result });
  }

  return { event, results };
}

/**
 * Publishes a NIP-09 kind 5 deletion event referencing a specific event ID.
 * This is belt-and-suspenders alongside the empty manifest — some relays
 * honor deletion requests and actually remove events.
 *
 * @param {{ signEvent: (template: object) => Promise<object> }} signer
 * @param {string} eventId - The event ID to request deletion of
 * @param {string[]} relays - Relay WebSocket URLs
 * @returns {Promise<{ event: object, results: { relay: string, success: boolean, message?: string }[] }>}
 */
export async function publishDeletionEvent(signer, eventId, relays) {
  const template = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', eventId]],
    content: 'nsite deletion via nsite.run',
  };
  const event = await signer.signEvent(template);

  const results = [];
  for (const relay of relays) {
    const result = await publishToRelay(event, relay).catch(() => ({
      success: false,
      message: 'connection failed',
    }));
    results.push({ relay, ...result });
  }

  return { event, results };
}
