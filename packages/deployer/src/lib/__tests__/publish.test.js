import { describe, it, expect, vi } from 'vitest';
import { buildManifest, publishEmptyManifest, publishManifest } from '../publish.js';

const sampleFiles = [
  { path: '/index.html', sha256: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888' },
  { path: '/style.css', sha256: '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb' },
  { path: '/app.js', sha256: '2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb9999cccc' },
];

const sampleServers = ['https://nsite.run'];
const sampleRelays = ['wss://relay.one', 'wss://relay.two'];

describe('buildManifest', () => {
  it('returns an event template with kind 15128', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    expect(event.kind).toBe(15128);
  });

  it('has content as empty string', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    expect(event.content).toBe('');
  });

  it('has a created_at timestamp (unix seconds)', () => {
    const before = Math.floor(Date.now() / 1000);
    const event = buildManifest(sampleFiles, sampleServers, false);
    const after = Math.floor(Date.now() / 1000);
    expect(event.created_at).toBeGreaterThanOrEqual(before);
    expect(event.created_at).toBeLessThanOrEqual(after);
  });

  it('is not signed (no id, sig, pubkey)', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    expect(event.id).toBeUndefined();
    expect(event.sig).toBeUndefined();
    expect(event.pubkey).toBeUndefined();
  });

  it('includes a path tag for each file', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    // 3 files = 3 path tags (no spaFallback)
    expect(pathTags.length).toBe(3);
  });

  it('path tags have correct format [path, /file, sha256]', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    for (const file of sampleFiles) {
      const tag = pathTags.find((t) => t[1] === file.path);
      expect(tag).toBeDefined();
      expect(tag[2]).toBe(file.sha256);
    }
  });

  it('includes a server tag for each blossom server', () => {
    const servers = ['https://nsite.run', 'https://cdn.example.com'];
    const event = buildManifest(sampleFiles, servers, false);
    const serverTags = event.tags.filter((t) => t[0] === 'server');
    expect(serverTags.length).toBe(2);
    expect(serverTags.map((t) => t[1])).toContain('https://nsite.run');
    expect(serverTags.map((t) => t[1])).toContain('https://cdn.example.com');
  });

  it('includes a relay tag for each relay hint', () => {
    const event = buildManifest(sampleFiles, sampleServers, { relays: sampleRelays });
    const relayTags = event.tags.filter((t) => t[0] === 'relay');
    expect(relayTags.length).toBe(2);
    expect(relayTags.map((t) => t[1])).toEqual(sampleRelays);
  });

  it('with spaFallback=true adds /404.html path tag pointing to index.html sha256', () => {
    const event = buildManifest(sampleFiles, sampleServers, true);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    const fallbackTag = pathTags.find((t) => t[1] === '/404.html');
    expect(fallbackTag).toBeDefined();
    expect(fallbackTag[2]).toBe(sampleFiles[0].sha256); // index.html sha256
  });

  it('with spaFallback=true the total path tags = files + 1', () => {
    const event = buildManifest(sampleFiles, sampleServers, true);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    expect(pathTags.length).toBe(sampleFiles.length + 1);
  });

  it('with spaFallback=true but no index.html does NOT add /404.html tag', () => {
    const filesWithoutIndex = [
      { path: '/about.html', sha256: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888' },
      { path: '/style.css', sha256: '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb' },
    ];
    const event = buildManifest(filesWithoutIndex, sampleServers, true);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    const fallbackTag = pathTags.find((t) => t[1] === '/404.html');
    expect(fallbackTag).toBeUndefined();
  });

  it('with spaFallback=false does NOT add /404.html tag', () => {
    const event = buildManifest(sampleFiles, sampleServers, false);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    const fallbackTag = pathTags.find((t) => t[1] === '/404.html');
    expect(fallbackTag).toBeUndefined();
  });

  it('with multiple servers all get separate server tags', () => {
    const servers = ['https://a.example.com', 'https://b.example.com', 'https://c.example.com'];
    const event = buildManifest(sampleFiles, servers, false);
    const serverTags = event.tags.filter((t) => t[0] === 'server');
    expect(serverTags.length).toBe(3);
  });

  it('handles empty file list gracefully', () => {
    const event = buildManifest([], sampleServers, false);
    expect(event.kind).toBe(15128);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    expect(pathTags.length).toBe(0);
  });

  it('handles empty server list gracefully', () => {
    const event = buildManifest(sampleFiles, [], false);
    const serverTags = event.tags.filter((t) => t[0] === 'server');
    expect(serverTags.length).toBe(0);
  });

  it('handles empty relay list gracefully', () => {
    const event = buildManifest(sampleFiles, sampleServers, { relays: [] });
    const relayTags = event.tags.filter((t) => t[0] === 'relay');
    expect(relayTags.length).toBe(0);
  });

  // --- Options object backward compat ---

  it('accepts spaFallback as options object { spaFallback: true }', () => {
    const event = buildManifest(sampleFiles, sampleServers, { spaFallback: true });
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    const fallbackTag = pathTags.find((t) => t[1] === '/404.html');
    expect(fallbackTag).toBeDefined();
    expect(event.kind).toBe(15128);
  });

  it('accepts spaFallback as options object { spaFallback: false }', () => {
    const event = buildManifest(sampleFiles, sampleServers, { spaFallback: false });
    expect(event.kind).toBe(15128);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    expect(pathTags.length).toBe(3);
  });

  // --- kind 35128 named site support ---

  it('with options.kind=35128 produces kind 35128 event', () => {
    const event = buildManifest(sampleFiles, sampleServers, { kind: 35128, dTag: 'blog' });
    expect(event.kind).toBe(35128);
  });

  it('with options.dTag produces a d tag', () => {
    const event = buildManifest(sampleFiles, sampleServers, { kind: 35128, dTag: 'blog' });
    const dTag = event.tags.find((t) => t[0] === 'd');
    expect(dTag).toBeDefined();
    expect(dTag[1]).toBe('blog');
  });

  it('without options.dTag does NOT produce a d tag', () => {
    const event = buildManifest(sampleFiles, sampleServers, {});
    const dTag = event.tags.find((t) => t[0] === 'd');
    expect(dTag).toBeUndefined();
  });

  it('with options.kind=35128 and dTag includes all standard tags too', () => {
    const event = buildManifest(sampleFiles, sampleServers, { kind: 35128, dTag: 'myblog', relays: sampleRelays });
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    const serverTags = event.tags.filter((t) => t[0] === 'server');
    const relayTags = event.tags.filter((t) => t[0] === 'relay');
    const clientTag = event.tags.find((t) => t[0] === 'client');
    const dTag = event.tags.find((t) => t[0] === 'd');
    expect(pathTags.length).toBe(3);
    expect(serverTags.length).toBe(1);
    expect(relayTags.length).toBe(2);
    expect(clientTag).toBeDefined();
    expect(dTag).toBeDefined();
    expect(dTag[1]).toBe('myblog');
  });

  // --- title and description metadata ---

  it('with options.title adds a title tag', () => {
    const event = buildManifest(sampleFiles, sampleServers, { title: 'My Site' });
    const titleTag = event.tags.find((t) => t[0] === 'title');
    expect(titleTag).toBeDefined();
    expect(titleTag[1]).toBe('My Site');
  });

  it('with options.description adds a description tag', () => {
    const event = buildManifest(sampleFiles, sampleServers, { description: 'A blog about stuff' });
    const descTag = event.tags.find((t) => t[0] === 'description');
    expect(descTag).toBeDefined();
    expect(descTag[1]).toBe('A blog about stuff');
  });

  it('with options.title="" does NOT add a title tag (empty string omitted)', () => {
    const event = buildManifest(sampleFiles, sampleServers, { title: '' });
    const titleTag = event.tags.find((t) => t[0] === 'title');
    expect(titleTag).toBeUndefined();
  });

  it('with options.description="" does NOT add a description tag (empty string omitted)', () => {
    const event = buildManifest(sampleFiles, sampleServers, { description: '' });
    const descTag = event.tags.find((t) => t[0] === 'description');
    expect(descTag).toBeUndefined();
  });

  it('without title/description options no title or description tags', () => {
    const event = buildManifest(sampleFiles, sampleServers, {});
    const titleTag = event.tags.find((t) => t[0] === 'title');
    const descTag = event.tags.find((t) => t[0] === 'description');
    expect(titleTag).toBeUndefined();
    expect(descTag).toBeUndefined();
  });

  it('all options combined: kind 35128 + dTag + title + description + spaFallback', () => {
    const event = buildManifest(sampleFiles, sampleServers, {
      kind: 35128,
      dTag: 'portfolio',
      title: 'My Portfolio',
      description: 'A showcase of my work',
      spaFallback: true,
      relays: sampleRelays,
    });
    expect(event.kind).toBe(35128);
    expect(event.tags.find((t) => t[0] === 'd')?.[1]).toBe('portfolio');
    expect(event.tags.find((t) => t[0] === 'title')?.[1]).toBe('My Portfolio');
    expect(event.tags.find((t) => t[0] === 'description')?.[1]).toBe('A showcase of my work');
    expect(event.tags.filter((t) => t[0] === 'relay').map((t) => t[1])).toEqual(sampleRelays);
    const pathTags = event.tags.filter((t) => t[0] === 'path');
    // spaFallback adds /404.html
    expect(pathTags.length).toBe(sampleFiles.length + 1);
  });
});

describe('publishEmptyManifest', () => {
  function makeMockSigner() {
    return {
      signEvent: vi.fn(async (template) => ({ ...template, id: 'mock-id', sig: 'mock-sig', pubkey: 'mock-pubkey' })),
    };
  }

  it('backward compat: no options publishes kind 15128', async () => {
    const signer = makeMockSigner();
    // Mock WebSocket to avoid real network calls
    global.WebSocket = class {
      constructor() { this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null; }
      send() {}
      close() {}
    };

    await publishEmptyManifest(signer, []).catch(() => {});
    const template = signer.signEvent.mock.calls[0][0];
    expect(template.kind).toBe(15128);
    const dTag = template.tags.find((t) => t[0] === 'd');
    expect(dTag).toBeUndefined();
  });

  it('with options.dTag publishes kind 35128 with d tag', async () => {
    const signer = makeMockSigner();
    global.WebSocket = class {
      constructor() { this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null; }
      send() {}
      close() {}
    };

    await publishEmptyManifest(signer, [], { dTag: 'blog' }).catch(() => {});
    const template = signer.signEvent.mock.calls[0][0];
    expect(template.kind).toBe(35128);
    const dTag = template.tags.find((t) => t[0] === 'd');
    expect(dTag).toBeDefined();
    expect(dTag[1]).toBe('blog');
  });
});

describe('publishManifest', () => {
  function makeMockSigner() {
    return {
      signEvent: vi.fn(async (template) => ({
        ...template,
        id: `mock-id-${template.kind}`,
        sig: 'mock-sig',
        pubkey: 'mock-pubkey',
      })),
    };
  }

  class MockWebSocket {
    static sent = [];

    constructor(url) {
      this.url = url;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      queueMicrotask(() => {
        this.onopen?.();
      });
    }

    send(payload) {
      MockWebSocket.sent.push({ url: this.url, payload: JSON.parse(payload) });
      const [, event] = JSON.parse(payload);
      queueMicrotask(() => {
        this.onmessage?.({
          data: JSON.stringify(['OK', event.id, true, 'accepted']),
        });
      });
    }

    close() {}
  }

  it('publishes only the site manifest and does not sign a 10002 relay list', async () => {
    const signer = makeMockSigner();
    MockWebSocket.sent = [];
    global.WebSocket = MockWebSocket;

    const result = await publishManifest(
      signer,
      sampleFiles,
      ['https://nsite.run'],
      ['wss://relay.one', 'wss://relay.two'],
      false,
    );

    expect(signer.signEvent).toHaveBeenCalledTimes(1);
    expect(signer.signEvent.mock.calls[0][0].kind).toBe(15128);
    expect(signer.signEvent.mock.calls[0][0].tags.filter((t) => t[0] === 'relay').map((t) => t[1])).toEqual(['wss://relay.one', 'wss://relay.two']);
    expect(MockWebSocket.sent).toHaveLength(2);
    expect(MockWebSocket.sent.every(({ payload }) => payload[0] === 'EVENT')).toBe(true);
    expect(MockWebSocket.sent.every(({ payload }) => payload[1].kind === 15128)).toBe(true);
    expect(result.results.every((entry) => !('relayListAccepted' in entry))).toBe(true);
  });

  it('throws only when the manifest is rejected by every relay', async () => {
    const signer = makeMockSigner();

    global.WebSocket = class {
      constructor() {
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        queueMicrotask(() => {
          this.onopen?.();
        });
      }

      send(payload) {
        const [, event] = JSON.parse(payload);
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify(['OK', event.id, false, 'blocked']),
          });
        });
      }

      close() {}
    };

    await expect(
      publishManifest(signer, sampleFiles, ['https://nsite.run'], ['wss://relay.one'], false),
    ).rejects.toThrow('Manifest rejected by all 1 relay(s):\nwss://relay.one: blocked');
  });
});
