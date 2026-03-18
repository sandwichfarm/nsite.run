import { describe, it, expect, vi } from 'vitest';
import { buildAuthEvent, uploadBlobs, checkExistence } from '../upload.js';

// --- buildAuthEvent tests (existing) ---

describe('buildAuthEvent', () => {
  it('returns an event template with kind 24242', () => {
    const event = buildAuthEvent('abc123def456');
    expect(event.kind).toBe(24242);
  });

  it('has a [t, upload] tag by default', () => {
    const event = buildAuthEvent('abc123');
    const tTag = event.tags.find((t) => t[0] === 't');
    expect(tTag[1]).toBe('upload');
  });

  it('has multiple [x] tags for batch hashes', () => {
    const hashes = ['aaa111', 'bbb222', 'ccc333'];
    const event = buildAuthEvent(hashes);
    const xTags = event.tags.filter((t) => t[0] === 'x');
    expect(xTags).toHaveLength(3);
    expect(xTags.map(t => t[1])).toEqual(hashes);
  });

  it('has an [expiration] tag approximately 3600 seconds in the future', () => {
    const now = Math.floor(Date.now() / 1000);
    const event = buildAuthEvent('abc123');
    const expirationTag = event.tags.find((t) => t[0] === 'expiration');
    const expiration = parseInt(expirationTag[1], 10);
    expect(expiration).toBeGreaterThanOrEqual(now + 3595);
    expect(expiration).toBeLessThanOrEqual(now + 3605);
  });
});

// --- helpers for uploadBlobs tests ---

function makeFile(name, hash) {
  return { path: `/${name}`, data: new Uint8Array([1, 2, 3]), sha256: hash ?? name };
}

function fakeSigner() {
  return {
    signEvent: vi.fn(async (template) => ({
      ...template,
      id: 'fake-id',
      pubkey: 'fake-pubkey',
      sig: 'fake-sig',
    })),
  };
}

function mockFetchOk() {
  return vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
}

function mockFetchFail(status = 500) {
  return vi.fn(async () => ({ ok: false, status, text: async () => 'error' }));
}

// --- uploadBlobs tests ---

describe('uploadBlobs', () => {
  const S1 = 'https://server1.test';
  const S2 = 'https://server2.test';
  const S3 = 'https://server3.test';

  it('uploads all files to all servers when nothing exists', async () => {
    const files = [makeFile('a'), makeFile('b'), makeFile('c')];
    const existing = new Map();
    const signer = fakeSigner();
    const servers = [S1, S2];

    const uploads = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === 'PUT') uploads.push(url);
      return { ok: true, status: 200, text: async () => '' };
    });

    const result = await uploadBlobs(files, existing, signer, servers);

    expect(result.uploaded).toBe(3);
    expect(result.alreadyExist).toBe(0);
    expect(result.failed).toBe(0);
    // 3 files × 2 servers = 6 uploads
    expect(uploads).toHaveLength(6);
    expect(uploads.filter(u => u.includes('server1'))).toHaveLength(3);
    expect(uploads.filter(u => u.includes('server2'))).toHaveLength(3);

    globalThis.fetch = origFetch;
  });

  it('skips server that already has a file, uploads to others', async () => {
    const files = [makeFile('a'), makeFile('b')];
    // File 'a' exists on S1 but not S2. File 'b' exists nowhere.
    const existing = new Map([['a', new Set([S1])]]);
    const signer = fakeSigner();
    const servers = [S1, S2];

    const uploads = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === 'PUT') uploads.push(url);
      return { ok: true, status: 200, text: async () => '' };
    });

    const result = await uploadBlobs(files, existing, signer, servers);

    // Both files succeed (a: existed on S1 + uploaded to S2, b: uploaded to both)
    expect(result.uploaded).toBe(2);
    expect(result.alreadyExist).toBe(0);
    expect(result.failed).toBe(0);
    // File 'a' → only S2. File 'b' → S1 + S2. Total = 3 uploads.
    expect(uploads).toHaveLength(3);
    // S1 should NOT have an upload for file 'a'
    expect(uploads.filter(u => u.includes('server1'))).toHaveLength(1); // only file 'b'
    expect(uploads.filter(u => u.includes('server2'))).toHaveLength(2); // files 'a' and 'b'

    globalThis.fetch = origFetch;
  });

  it('fully skips files that exist on ALL servers', async () => {
    const files = [makeFile('a'), makeFile('b')];
    // File 'a' exists on both servers. File 'b' exists nowhere.
    const existing = new Map([['a', new Set([S1, S2])]]);
    const signer = fakeSigner();
    const servers = [S1, S2];

    const uploads = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === 'PUT') uploads.push(url);
      return { ok: true, status: 200, text: async () => '' };
    });

    const result = await uploadBlobs(files, existing, signer, servers);

    expect(result.uploaded).toBe(1); // only file 'b'
    expect(result.alreadyExist).toBe(1); // file 'a'
    expect(result.failed).toBe(0);
    // Only file 'b' uploaded to both servers = 2 uploads
    expect(uploads).toHaveLength(2);

    globalThis.fetch = origFetch;
  });

  it('per-server progress: skipped counts are pre-populated', async () => {
    const files = [makeFile('a'), makeFile('b'), makeFile('c')];
    // S1 has all 3 files. S2 has file 'a' only. S3 has nothing.
    const existing = new Map([
      ['a', new Set([S1, S2])],
      ['b', new Set([S1])],
      ['c', new Set([S1])],
    ]);
    const signer = fakeSigner();
    const servers = [S1, S2, S3];

    let firstProgress = null;
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opts) => {
      return { ok: true, status: 200, text: async () => '' };
    });

    const result = await uploadBlobs(files, existing, signer, servers, (p) => {
      if (!firstProgress) firstProgress = JSON.parse(JSON.stringify(p));
    });

    // S1 has all files → skipped=3, no uploads needed
    expect(result.serverProgress[S1].skipped).toBe(3);
    expect(result.serverProgress[S1].completed).toBe(0);
    expect(result.serverProgress[S1].failed).toBe(0);

    // S2 has file 'a' → skipped=1, files 'b' and 'c' uploaded
    expect(result.serverProgress[S2].skipped).toBe(1);
    expect(result.serverProgress[S2].completed).toBe(2);

    // S3 has nothing → skipped=0, all 3 uploaded (but 'a' is fullySkipped since on S1+S2... wait no, S3 doesn't have 'a')
    // Actually 'a' exists on S1 and S2 but NOT S3, so 'a' is NOT fullySkipped
    expect(result.serverProgress[S3].skipped).toBe(0);
    expect(result.serverProgress[S3].completed).toBe(3);

    // File 'a' is NOT fullySkipped because S3 doesn't have it
    expect(result.alreadyExist).toBe(0);
    expect(result.uploaded).toBe(3);

    globalThis.fetch = origFetch;
  });

  it('file on S1 and S2 but not S3 → uploads to S3 only', async () => {
    const files = [makeFile('x')];
    const existing = new Map([['x', new Set([S1, S2])]]);
    const signer = fakeSigner();
    const servers = [S1, S2, S3];

    const uploads = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opts) => {
      if (opts?.method === 'PUT') uploads.push(url);
      return { ok: true, status: 200, text: async () => '' };
    });

    const result = await uploadBlobs(files, existing, signer, servers);

    expect(result.uploaded).toBe(1);
    expect(result.alreadyExist).toBe(0);
    // Only uploaded to S3
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('server3');

    expect(result.serverProgress[S1].skipped).toBe(1);
    expect(result.serverProgress[S1].completed).toBe(0);
    expect(result.serverProgress[S2].skipped).toBe(1);
    expect(result.serverProgress[S2].completed).toBe(0);
    expect(result.serverProgress[S3].skipped).toBe(0);
    expect(result.serverProgress[S3].completed).toBe(1);

    globalThis.fetch = origFetch;
  });

  it('upload fails on all servers after retries → file counted as failed', async () => {
    const files = [makeFile('a')];
    const existing = new Map();
    const signer = fakeSigner();
    const servers = [S1, S2];

    const origFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = vi.fn(async () => { fetchCount++; return { ok: false, status: 500, text: async () => 'err' }; });

    vi.useFakeTimers();
    const resultPromise = uploadBlobs(files, existing, signer, servers);
    // Advance through all retry delays
    for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    vi.useRealTimers();

    expect(result.uploaded).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.serverProgress[S1].failed).toBe(1);
    expect(result.serverProgress[S2].failed).toBe(1);
    // 1 initial + 3 retries = 4 attempts per server, 2 servers = 8
    expect(fetchCount).toBe(8);

    globalThis.fetch = origFetch;
  });

  it('upload fails on S2 but file exists on S1 → success after retries', async () => {
    const files = [makeFile('a')];
    const existing = new Map([['a', new Set([S1])]]);
    const signer = fakeSigner();
    const servers = [S1, S2];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'err' }));

    vi.useFakeTimers();
    const resultPromise = uploadBlobs(files, existing, signer, servers);
    for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    vi.useRealTimers();

    // File exists on S1 → success even though S2 upload failed after retries
    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.serverProgress[S1].skipped).toBe(1);
    expect(result.serverProgress[S2].failed).toBe(1);

    globalThis.fetch = origFetch;
  });

  it('retry succeeds on second attempt', async () => {
    const files = [makeFile('a')];
    const existing = new Map();
    const signer = fakeSigner();
    const servers = [S1];

    const origFetch = globalThis.fetch;
    let attempt = 0;
    globalThis.fetch = vi.fn(async () => {
      attempt++;
      if (attempt === 1) return { ok: false, status: 502, text: async () => 'bad gateway' };
      return { ok: true, status: 200, text: async () => '' };
    });

    vi.useFakeTimers();
    const resultPromise = uploadBlobs(files, existing, signer, servers);
    for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    vi.useRealTimers();

    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.serverProgress[S1].completed).toBe(1);
    expect(result.serverProgress[S1].failed).toBe(0);
    expect(attempt).toBe(2);

    globalThis.fetch = origFetch;
  });

  it('signs auth only for files that need uploading', async () => {
    const files = [makeFile('a'), makeFile('b'), makeFile('c')];
    // All files exist on all servers → nothing to upload
    const existing = new Map([
      ['a', new Set([S1])],
      ['b', new Set([S1])],
      ['c', new Set([S1])],
    ]);
    const signer = fakeSigner();
    const servers = [S1];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));

    await uploadBlobs(files, existing, signer, servers);

    // All files exist on all servers → no signing needed
    expect(signer.signEvent).not.toHaveBeenCalled();

    globalThis.fetch = origFetch;
  });

  it('auth batches at 50 files max', async () => {
    const files = Array.from({ length: 120 }, (_, i) => makeFile(`f${i}`));
    const existing = new Map();
    const signer = fakeSigner();
    const servers = [S1];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));

    await uploadBlobs(files, existing, signer, servers);

    // 120 files / 50 per batch = 3 sign calls
    expect(signer.signEvent).toHaveBeenCalledTimes(3);

    globalThis.fetch = origFetch;
  });

  it('network error on fetch → counted as failed after retries', async () => {
    const files = [makeFile('a')];
    const existing = new Map();
    const signer = fakeSigner();
    const servers = [S1];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('NetworkError'); });

    vi.useFakeTimers();
    const resultPromise = uploadBlobs(files, existing, signer, servers);
    for (let i = 0; i < 20; i++) await vi.advanceTimersByTimeAsync(10000);
    const result = await resultPromise;
    vi.useRealTimers();

    expect(result.failed).toBe(1);
    expect(result.serverProgress[S1].failed).toBe(1);
    expect(result.fileResults[0].error).toContain('NetworkError');

    globalThis.fetch = origFetch;
  });

  it('progress callback fires with independent server progress', async () => {
    const files = [makeFile('a'), makeFile('b')];
    // 'a' exists on S1, not S2. 'b' exists nowhere.
    const existing = new Map([['a', new Set([S1])]]);
    const signer = fakeSigner();
    const servers = [S1, S2];
    const progressCalls = [];

    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));

    await uploadBlobs(files, existing, signer, servers, (p) => {
      progressCalls.push(JSON.parse(JSON.stringify(p)));
    });

    // Progress fires multiple times (once per server-file upload + initial)
    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    const last = progressCalls[progressCalls.length - 1];
    expect(last.total).toBe(2);
    // S1: skipped 'a', uploaded 'b'. S2: uploaded both.
    expect(last.serverProgress[S1].skipped).toBe(1);
    expect(last.serverProgress[S1].completed).toBe(1);
    expect(last.serverProgress[S2].skipped).toBe(0);
    expect(last.serverProgress[S2].completed).toBe(2);

    globalThis.fetch = origFetch;
  });
});
