/**
 * Builds a BUD-02 kind 24242 authorization event template (unsigned).
 *
 * @param {string | string[]} sha256hexes - Hex SHA-256 hash(es) of the blob(s)
 * @param {'upload' | 'delete' | string} [verb='upload'] - The authorization verb
 * @returns {{ kind: number, created_at: number, tags: string[][], content: string }}
 */
export function buildAuthEvent(sha256hexes, verb = 'upload') {
  const hashes = Array.isArray(sha256hexes) ? sha256hexes : [sha256hexes];
  const now = Math.floor(Date.now() / 1000);
  return {
    kind: 24242,
    created_at: now,
    tags: [
      ['t', verb],
      ...hashes.map(h => ['x', h]),
      ['expiration', String(now + 3600)],
    ],
    content: 'Upload blob via nsite.run',
  };
}

const CHECK_CONCURRENCY = 10;
const CHECK_TIMEOUT = 10_000; // 10s per HEAD request
const UPLOAD_CONCURRENCY_PER_SERVER = 3;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 7000]; // backoff: 1s, 3s, 7s

/**
 * Run async tasks with a concurrency limit.
 */
async function parallelMap(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(limit, items.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Check which blobs already exist on blossom servers.
 * Uses a global work queue with round-robin interleaving so workers
 * dynamically flow to whichever server has available work.
 *
 * @param {{ sha256: string }[]} files
 * @param {string[]} blossomUrls
 * @param {(progress: { total: number, serverChecks: Record<string, { checked: number, found: number, total: number }> }) => void} [onProgress]
 * @param {Set<string>} [givenUpServers]
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function checkExistence(files, blossomUrls, onProgress, givenUpServers) {
  const existing = new Map();

  // Initialize per-server check progress
  const serverChecks = {};
  for (const url of blossomUrls) {
    serverChecks[url] = { checked: 0, found: 0, total: files.length };
  }

  function emitProgress() {
    if (onProgress) {
      onProgress({ total: files.length, serverChecks });
    }
  }

  emitProgress();

  // Build interleaved work queue: round-robin by server
  // [(serverA, file1), (serverB, file1), ..., (serverA, file2), (serverB, file2), ...]
  const queue = [];
  for (const file of files) {
    for (const url of blossomUrls) {
      queue.push({ url, file });
    }
  }

  const globalConcurrency = Math.min(blossomUrls.length * CHECK_CONCURRENCY, 40);

  await parallelMap(queue, globalConcurrency, async ({ url, file }) => {
    if (givenUpServers && givenUpServers.has(url)) {
      serverChecks[url].checked++;
      emitProgress();
      return;
    }

    const base = url.replace(/\/$/, '');
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), CHECK_TIMEOUT);

    try {
      const resp = await fetch(`${base}/${file.sha256}`, {
        method: 'HEAD',
        signal: ac.signal,
      });
      if (resp.ok) {
        if (!existing.has(file.sha256)) {
          existing.set(file.sha256, new Set());
        }
        existing.get(file.sha256).add(url);
        serverChecks[url].found++;
      }
    } catch { /* timeout or network error */ } finally {
      clearTimeout(timer);
    }

    serverChecks[url].checked++;
    emitProgress();
  });

  return existing;
}

/**
 * @typedef {Object} ServerProgress
 * @property {number} total
 * @property {number} completed - Successfully uploaded
 * @property {number} skipped - Already existed
 * @property {number} failed
 * @property {number} retrying - Currently retrying
 *
 * @typedef {Object} UploadProgress
 * @property {number} total - Total files to process (excludes fully-skipped)
 * @property {number} completed - Files processed so far
 * @property {number} uploaded - Successfully uploaded (new)
 * @property {number} skipped - Already existed on all servers
 * @property {number} failed - Failed all servers
 * @property {string} current - Current file path
 * @property {Record<string, ServerProgress>} serverProgress - Per-server breakdown
 *
 * @typedef {Object} UploadResult
 * @property {number} uploaded
 * @property {number} alreadyExist
 * @property {number} failed
 * @property {number} total
 * @property {{ path: string, success: boolean, status: string, error?: string }[]} fileResults
 */

/**
 * Upload blobs to all blossom servers.
 *
 * Server-centric: each server runs its own independent upload queue in parallel.
 * Fast servers finish first. Bars progress independently.
 *
 * - If server already has all files → bar starts at 100%, no uploads.
 * - If server has some files → bar starts partial, grows as uploads complete.
 * - Files only on some servers get uploaded to missing servers.
 * - Files on ALL servers are fully skipped.
 * - Auth signed for files that need uploading to at least one server.
 * - Success = file on ≥1 server after all attempts.
 */
export async function uploadBlobs(files, existing, signer, blossomUrls, onProgress, givenUpServers) {
  // Pre-mark 0-byte files as existing on all servers — nothing to upload,
  // and some blossom servers (bunny) reject empty PUT bodies with 400.
  for (const file of files) {
    const size = file.data?.byteLength ?? file.data?.length ?? 0;
    if (size === 0) {
      if (!existing.has(file.sha256)) existing.set(file.sha256, new Set());
      for (const url of blossomUrls) existing.get(file.sha256).add(url);
    }
  }

  // Build per-server queues: which files does each server need?
  const serverQueues = new Map();
  const filesToUpload = new Set(); // unique files that need uploading to at least one server

  for (const url of blossomUrls) {
    const queue = [];
    for (const file of files) {
      const serversWithBlob = existing.get(file.sha256) ?? new Set();
      if (!serversWithBlob.has(url)) {
        queue.push(file);
        filesToUpload.add(file.sha256);
      }
    }
    serverQueues.set(url, queue);
  }

  const filesToUploadList = files.filter(f => filesToUpload.has(f.sha256));
  const fullySkippedCount = files.length - filesToUploadList.length;

  // Sign auth for files that need uploading
  const AUTH_BATCH_SIZE = 50;
  const authHeaders = new Map();
  for (let i = 0; i < filesToUploadList.length; i += AUTH_BATCH_SIZE) {
    const batch = filesToUploadList.slice(i, i + AUTH_BATCH_SIZE);
    const hashes = batch.map(f => f.sha256);
    const template = buildAuthEvent(hashes, 'upload');
    const signed = await signer.signEvent(template);
    const header = 'Nostr ' + btoa(JSON.stringify(signed));
    for (const hash of hashes) {
      authHeaders.set(hash, header);
    }
  }

  // Pre-populate per-server progress
  const serverProgress = {};
  for (const url of blossomUrls) {
    const queue = serverQueues.get(url);
    const skipped = files.length - queue.length;
    serverProgress[url] = { total: files.length, completed: 0, skipped, failed: 0, retrying: 0 };
  }

  // Track per-file results across all servers
  const fileServerSuccess = new Map(); // sha256 → Set<serverUrl> that succeeded
  const fileErrors = new Map(); // sha256 → last error string
  for (const file of files) {
    fileServerSuccess.set(file.sha256, new Set(existing.get(file.sha256) ?? []));
  }

  // Fire progress
  function emitProgress(current) {
    if (!onProgress) return;
    // Count completed files: files where all servers have either skipped, completed, or failed
    let filesCompleted = 0;
    let filesUploaded = 0;
    let filesFailed = 0;
    for (const file of filesToUploadList) {
      const serversWithBlob = existing.get(file.sha256) ?? new Set();
      let allDone = true;
      for (const url of blossomUrls) {
        if (serversWithBlob.has(url)) continue; // skipped
        const sp = serverProgress[url];
        // This file is "done" on this server if the server has processed past it
        // We can't track per-file-per-server easily, so use aggregate counts
      }
      // Simpler: check if this file succeeded on any new server
      const successes = fileServerSuccess.get(file.sha256);
      if (successes.size > serversWithBlob.size) {
        filesUploaded++;
      }
    }
    // Use server-level completion as proxy for overall progress
    let totalServerOps = 0;
    let completedServerOps = 0;
    for (const url of blossomUrls) {
      const sp = serverProgress[url];
      totalServerOps += sp.total;
      completedServerOps += sp.completed + sp.skipped + sp.failed;
    }
    const completed = Math.min(
      filesToUploadList.length,
      Math.floor((completedServerOps / (totalServerOps || 1)) * filesToUploadList.length)
    );
    onProgress({
      total: filesToUploadList.length,
      completed,
      uploaded: filesUploaded,
      skipped: fullySkippedCount,
      failed: filesFailed,
      current: current ?? '',
      serverProgress,
    });
  }

  // Initial progress with pre-populated skips
  emitProgress('');

  // Run all server queues in parallel — each server progresses independently
  await Promise.all(blossomUrls.map(async (url) => {
    const queue = serverQueues.get(url);
    if (queue.length === 0) return;

    const base = url.replace(/\/$/, '');

    await parallelMap(queue, UPLOAD_CONCURRENCY_PER_SERVER, async (file) => {
      if (givenUpServers && givenUpServers.has(url)) return;
      let lastError = '';

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (givenUpServers && givenUpServers.has(url)) break;
        if (attempt > 0) {
          // Backoff before retry
          serverProgress[url].retrying++;
          emitProgress(file.path);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          serverProgress[url].retrying--;
        }

        try {
          const resp = await fetch(`${base}/upload`, {
            method: 'PUT',
            headers: {
              Authorization: authHeaders.get(file.sha256),
              'Content-Type': 'application/octet-stream',
            },
            body: file.data,
          });

          if (resp.ok) {
            serverProgress[url].completed++;
            fileServerSuccess.get(file.sha256).add(url);
            emitProgress(file.path);
            lastError = '';
            break;
          } else {
            const body = await resp.text().catch(() => '');
            lastError = `${url}: HTTP ${resp.status} ${body}`.trim();
          }
        } catch (err) {
          lastError = `${url}: ${err?.message ?? String(err)}`;
        }
      }

      // All attempts exhausted
      if (lastError) {
        fileErrors.set(file.sha256, lastError);
        serverProgress[url].failed++;
        emitProgress(file.path);
      }
    });
  }));

  // Build file results
  const fileResults = [];
  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const successes = fileServerSuccess.get(file.sha256);
    if (successes.size === blossomUrls.length && !filesToUpload.has(file.sha256)) {
      // Fully skipped — existed on all servers before upload
      fileResults.push({ path: file.path, success: true, status: 'exists' });
    } else if (successes.size > 0) {
      uploaded++;
      fileResults.push({ path: file.path, success: true, status: 'uploaded' });
    } else {
      failed++;
      fileResults.push({ path: file.path, success: false, status: 'failed', error: fileErrors.get(file.sha256) });
    }
  }

  // Final progress
  emitProgress('');

  return { uploaded, alreadyExist: fullySkippedCount, failed, total: files.length, fileResults, serverProgress };
}
