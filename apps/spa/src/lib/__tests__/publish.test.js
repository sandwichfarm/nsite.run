import { describe, it, expect } from 'vitest';
import { buildManifest } from '../publish.js';

const sampleFiles = [
  { path: '/index.html', sha256: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888' },
  { path: '/style.css', sha256: '1111aaaa2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb' },
  { path: '/app.js', sha256: '2222bbbb3333cccc4444dddd5555eeee6666ffff7777aaaa8888bbbb9999cccc' },
];

const sampleServers = ['https://nsite.run'];

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
});
