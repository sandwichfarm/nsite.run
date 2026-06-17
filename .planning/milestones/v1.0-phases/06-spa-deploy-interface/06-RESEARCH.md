# Phase 06: SPA Deploy Interface - Research

**Researched:** 2026-03-17
**Domain:** Svelte 4 + Vite SPA, Nostr NIP-07/NIP-46, Blossom BUD-02, Browser File APIs, Secret Scanning
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All three file input methods: drag-drop zone, folder picker (showDirectoryPicker), and file picker for zip/tar.gz archives
- File review step shows expandable file tree with directory structure and file sizes
- SPA fallback toggle: checkbox "This is a single-page app" that maps index.html to /404.html in manifest
- Deploy progress uses multi-step indicator: Hashing files → Uploading blobs → Publishing manifest → Done, each step with its own progress
- After successful deploy: show link to site + deploy summary (files, manifest, servers used) + share options (copy URL, share on nostr, view manifest event)
- No site management — this is a deploy tool, not a dashboard
- Single page: deploy section prominently at top, educational content scrolls below
- Fresh educational content (not ported from existing nsite.run components), more concise
- Dark theme consistent with current nsite.run (dark gray/purple palette, Tailwind CSS)
- Port tools-resources.yaml from ~/Develop/nsite.run for the links/resources section (SPA-12)
- Root sites only for v1 (kind 15128) — named site support deferred
- **Anonymous deploy is the default** — generate ephemeral keypair in-browser, deploy immediately, show npub + site URL
- After anonymous deploy: show nsec with copy-to-clipboard button so user can save for future updates
- Big "Deploy" button/drop zone visible immediately; small "Login with your identity" link as secondary option
- Login button in top-right navbar
- Two login options: "Extension" (NIP-07) and "Remote Signer" (NIP-46)
- NIP-46 flow: immediately generate NostrConnect QR code (in-browser QR library) in addition to bunker URI input
- NIP-46 uses ephemeral keypair per session
- After login: show avatar + display name + truncated npub (fetch kind 0 profile)
- Session persists across page reloads (localStorage)
- Use applesauce-signers library for NIP-07 + NIP-46 signing
- Always publish manifest to wss://nsite.run relay AND upload blobs to nsite.run blossom
- Also publish to user's outbox relays (NIP-65 kind 10002) and user's blossom server list (kind 10063)
- Expandable "Advanced" section (collapsed by default) for adding additional relay and blossom server URLs
- Client-side only secret scanning — all scanning in browser before upload, no files touch server until approved
- Dangerous filenames (.env, id_rsa, *.pem, etc.): warn with override — user can exclude or proceed
- Content regex patterns (API keys, tokens): same behavior — warn with override
- Port scanning patterns from nsyte (~/Develop/nsyte) as baseline
- Flagged files get inline warning icons in the file tree with click-to-see-why detail and checkbox to exclude/include
- .git/, .svn/, .hg/ directories: auto-exclude with notice ("Excluded 142 files from .git/")
- Monorepo placement: new app under apps/spa (or similar) with Vite build pipeline (not esbuild)
- applesauce-signers ^5.1.0 (same version as nsyte)

### Claude's Discretion
- Exact Svelte component structure and routing
- Tailwind config and exact color palette within dark theme
- QR code library selection
- Archive extraction approach (zip/tar.gz in browser)
- Exact secret scanning regex patterns (ported from nsyte, adjusted as needed)
- Educational content copy and structure
- Error state handling and edge cases

### Deferred Ideas (OUT OF SCOPE)
- Named site support (kind 35128 with identifier) — future enhancement
- Site management dashboard (view current files, last deploy) — separate phase
- Server-side secret scanning as defense-in-depth — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPA-01 | SPA serves at root domain (nsite.run, no npub subdomain) | Gateway handleSpaStub already wired; Phase 6 replaces stub with real SPA file serving |
| SPA-02 | User can authenticate via NIP-07 browser extension | applesauce-signers ExtensionSigner — proxy for window.nostr |
| SPA-03 | User can authenticate via NIP-46 Nostr Connect / bunker | applesauce-signers NostrConnectSigner — getNostrConnectURI + fromBunkerURI |
| SPA-04 | User can select a folder for upload (directory picker) | File System Access API showDirectoryPicker (Chromium) + HTML input[webkitdirectory] fallback |
| SPA-05 | User can upload a zip or tar.gz archive | fflate for zip; nanotar for tar.gz — both browser-native |
| SPA-06 | SPA extracts and displays file list for user confirmation before upload | File review component with expandable tree + size display |
| SPA-07 | SPA scans files for dangerous filenames (.env, id_rsa, *.pem, etc.) and blocks upload | Client-side filename allowlist/blocklist; auto-exclude .git/, .svn/, .hg/ |
| SPA-08 | SPA scans file content with regex patterns for secrets (API keys, tokens) and warns | Client-side TextDecoder + regex scan; warn with override + exclude checkbox |
| SPA-09 | SPA publishes site manifest (kind 15128) to the gateway's relay | createSiteManifestTemplate from nsyte/packages/shared pattern; WebSocket to wss://nsite.run |
| SPA-10 | SPA uploads file blobs to the gateway's blossom server | BUD-02: PUT /upload with Authorization: Nostr <base64-event>; kind 24242 auth event |
| SPA-11 | SPA includes educational content about nsites (what they are, how they work) | Fresh content below deploy section |
| SPA-12 | SPA links to other nsite gateways, tools, relays, and blossom servers | Port tools-resources.yaml from ~/Develop/nsite.run |
| SPA-13 | SPA is built with Svelte | Svelte 4 + Vite + Tailwind CSS; apps/spa in monorepo |
</phase_requirements>

---

## Summary

Phase 6 builds a client-side Svelte SPA that lives at the root domain (nsite.run). It is the entry point for deploying static sites to the nsite network — anonymous by default (ephemeral keypair), optionally authenticated via NIP-07 or NIP-46. The SPA is a new app under `apps/spa` in the existing Deno monorepo, using Vite + Svelte 4 + Tailwind CSS (not esbuild like the Edge Scripts). The gateway's `handleSpaStub` in `stubs/spa.ts` is already wired — Phase 6 replaces it with a real static-file server that reads the SPA's `dist/` build output.

The two technically novel areas are: (1) browser-native archive extraction (fflate for zip, nanotar for tar.gz) and (2) client-side secret scanning implemented from scratch (nsyte has no file-content scanning). Everything else has precedent in the existing codebase — applesauce-signers is already used by nsyte, the manifest event format is defined in `packages/shared` and nsyte, and the BUD-02 upload auth pattern is implemented in nsyte's `upload.ts`.

**Primary recommendation:** Build apps/spa as a Vite + Svelte 4 project with its own package.json and build script. Keep it entirely decoupled from the Deno/esbuild pipeline. The gateway serves the SPA's static files by embedding them into the bundle or reading from a known path at deploy time.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | ^4.2.20 | UI framework | Locked decision; same version as nsite.run |
| @sveltejs/vite-plugin-svelte | ^3.0.0 | Vite plugin for Svelte 4 | Required companion for Svelte 4 + Vite |
| vite | ^5.0.0 | Build tool + dev server | Locked decision; same as nsite.run |
| tailwindcss | ^3.4.0 | Utility CSS | Locked decision; same as nsite.run |
| postcss | ^8.5.6 | Tailwind compilation | Required by Tailwind |
| autoprefixer | ^10.4.21 | CSS vendor prefixes | Standard Tailwind companion |
| applesauce-signers | ^5.1.0 | NIP-07 + NIP-46 signing | Locked; same version as nsyte |
| applesauce-core | ^5.1.0 | Event store, helpers | Used by nsyte for relay pool + event building |
| applesauce-relay | ^5.1.0 | RelayPool for WebSocket relay comms | Used by nsyte for relay connections |
| nostr-tools | ^2.x | npubEncode, nip19, event helpers | Peer dependency of applesauce packages |
| fflate | ^0.8.2 | ZIP extraction in browser | Fastest pure-JS zip; 8KB; browser-native |
| nanotar | ^0.1.1 | TAR parsing in browser | Tiny (~1KB gzipped), tree-shakable; unjs ecosystem |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qrcode | ^1.5.4 | QR code generation on canvas | Claude's discretion; `qrcode` is well-maintained, browser-compatible via Vite |
| @rollup/plugin-yaml | ^4.1.2 | Import tools-resources.yaml | Same as nsite.run |
| js-yaml | ^4.1.0 | YAML parse support | Same as nsite.run |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| qrcode | svelte-qrcode / qrious | `qrcode` is simpler, well-tested, no framework coupling; svelte-qrcode is a thin wrapper anyway |
| nanotar | js-untar | nanotar is actively maintained in unjs ecosystem; js-untar is unmaintained since 2017 |
| fflate | JSZip | fflate is 3-5x smaller and faster for extraction; JSZip is overkill for read-only unzip |
| Svelte 4 | Svelte 5 | Locked decision (dark theme, same codebase as nsite.run which uses Svelte 4.2.20) |

### Installation
```bash
cd apps/spa
npm install svelte @sveltejs/vite-plugin-svelte vite tailwindcss postcss autoprefixer
npm install applesauce-signers applesauce-core applesauce-relay nostr-tools
npm install fflate nanotar qrcode @rollup/plugin-yaml
npm install --save-dev @types/qrcode
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/spa/
├── package.json           # npm-based (not deno.json) — Vite/Svelte ecosystem
├── vite.config.js
├── svelte.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html             # Vite entry point
├── src/
│   ├── main.js            # Mount App.svelte
│   ├── App.svelte         # Root: navbar, deploy section, educational content
│   ├── app.css            # Tailwind directives
│   ├── lib/
│   │   ├── crypto.js      # SHA-256 hashing with WebCrypto
│   │   ├── files.js       # Directory picker, zip/tar extraction, file tree
│   │   ├── scanner.js     # Secret scanning: filename patterns + content regex
│   │   ├── upload.js      # BUD-02 blob upload (PUT /upload)
│   │   ├── publish.js     # Manifest event build + WebSocket relay publish
│   │   ├── nostr.js       # Relay pool, kind 0 fetch, NIP-65, kind 10063 fetch
│   │   └── store.js       # Svelte writable stores + localStorage persistence
│   └── components/
│       ├── Navbar.svelte          # Login button, auth status
│       ├── DeployZone.svelte      # Drag-drop + folder picker + zip picker
│       ├── FileTree.svelte        # Expandable file list with warnings + checkboxes
│       ├── ProgressIndicator.svelte  # Multi-step: Hashing / Uploading / Publishing / Done
│       ├── SuccessPanel.svelte    # Link + summary + share options
│       ├── LoginModal.svelte      # Extension vs Remote Signer choice
│       ├── NIP46Dialog.svelte     # QR code + bunker URI input
│       ├── AdvancedConfig.svelte  # Collapsed section for extra relays/blossom
│       └── ToolsResources.svelte  # Educational links from tools-resources.yaml
├── public/
│   └── favicon.ico
└── dist/                  # Vite build output (served by gateway)
```

### Pattern 1: Anonymous Deploy (Default Path)
**What:** Generate ephemeral PrivateKeySigner in browser; deploy immediately; show nsec at success for user to save.
**When to use:** Default — user lands on page and drops files with no prior login action.
```javascript
// Source: applesauce-signers PrivateKeySigner API (verified in deno cache)
import { PrivateKeySigner } from 'applesauce-signers';

// Generate fresh keypair — no args = random key
const signer = new PrivateKeySigner();
const pubkey = await signer.getPublicKey();

// Show nsec after successful deploy
import { bytesToHex } from '@noble/hashes/utils';
import { nsecEncode } from 'nostr-tools/nip19';
const nsec = nsecEncode(signer.key); // signer.key is Uint8Array
```

### Pattern 2: NIP-07 Extension Login
**What:** ExtensionSigner wraps window.nostr; throws ExtensionMissingError if no extension.
**When to use:** User clicks "Extension" in login modal.
```javascript
// Source: applesauce-signers 5.1.0 type definitions (verified in deno cache)
import { ExtensionSigner } from 'applesauce-signers';

const signer = new ExtensionSigner();
try {
  const pubkey = await signer.getPublicKey(); // triggers extension prompt
} catch (e) {
  // Handle ExtensionMissingError
}
```

### Pattern 3: NIP-46 Remote Signer with QR Code
**What:** Generate NostrConnectSigner, get URI immediately, render QR code, wait for signer to connect.
**When to use:** User clicks "Remote Signer" in login modal.
```javascript
// Source: applesauce-signers 5.1.0 NostrConnectSigner API (verified in deno cache)
import { NostrConnectSigner, PrivateKeySigner } from 'applesauce-signers';
import { RelayPool } from 'applesauce-relay/pool';

// Must set static pool before creating signer
const pool = new RelayPool();
NostrConnectSigner.pool = pool;

const signer = new NostrConnectSigner({
  relays: ['wss://nsite.run', 'wss://relay.primal.net'],
  signer: new PrivateKeySigner(), // ephemeral client keypair
});

// Get URI immediately for QR code — no await needed
const uri = signer.getNostrConnectURI({
  name: 'nsite.run Deploy',
  url: 'https://nsite.run',
});

// Render QR code from uri string (nostrconnect://...)
// Then wait for remote signer to connect:
await signer.waitForSigner();
const pubkey = await signer.getPublicKey();

// Connect via bunker:// URI (user pastes it):
const signer2 = await NostrConnectSigner.fromBunkerURI('bunker://...', {});
```

### Pattern 4: BUD-02 Blob Upload
**What:** SHA-256 hash file in browser, create kind 24242 auth event, PUT to /upload.
**When to use:** Uploading each file blob during deploy.
```javascript
// Source: BUD-02 spec + nsyte upload.ts pattern (verified in codebase)
async function uploadBlob(file, sha256hex, signer, blossomUrl) {
  // Build kind 24242 authorization event
  const authTemplate = {
    kind: 24242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'upload'],
      ['x', sha256hex],
      ['expiration', String(Math.floor(Date.now() / 1000) + 3600)],
    ],
    content: 'Upload blob via nsite.run',
  };
  const signedAuth = await signer.signEvent(authTemplate);
  const authHeader = 'Nostr ' + btoa(JSON.stringify(signedAuth));

  // Check existence first (HEAD) to skip already-uploaded files
  const headResp = await fetch(`${blossomUrl}/${sha256hex}`, { method: 'HEAD' });
  if (headResp.ok) return; // already exists

  const resp = await fetch(`${blossomUrl}/upload`, {
    method: 'PUT',
    headers: { 'Authorization': authHeader, 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
}
```

### Pattern 5: Manifest Event (Kind 15128)
**What:** Build and publish kind 15128 event with path tags to relay via WebSocket.
**When to use:** Final step of deploy after all blobs uploaded.
```javascript
// Source: nsyte src/lib/manifest.ts (verified in codebase) + packages/shared constants
// NsiteKind.ROOT_SITE = 15128
const manifestTemplate = {
  kind: 15128,
  created_at: Math.floor(Date.now() / 1000),
  tags: [
    // One ["path", "/index.html", "<sha256>"] per file
    ...files.map(f => ['path', f.path, f.sha256]),
    // Server hints for blossom
    ['server', 'https://nsite.run'],
    // SPA fallback: map /index.html to /404.html for SPAs
    // Implemented as an additional path tag pointing 404.html -> index.html sha256
    ...(spaFallback ? [['path', '/404.html', indexSha256]] : []),
  ],
  content: '',
};
const signedManifest = await signer.signEvent(manifestTemplate);
// Publish via WebSocket using applesauce-relay RelayPool
```

### Pattern 6: Browser SHA-256 Hashing
**What:** Hash file content using WebCrypto API — available in all modern browsers.
**When to use:** "Hashing files" step in deploy progress.
```javascript
// Source: Same pattern as nsyte src/lib/files.ts calculateFileHash (adapted for browser)
async function hashFile(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}
```

### Pattern 7: ZIP Extraction with fflate
**What:** Extract zip archive in browser to virtual file list.
**When to use:** User uploads a .zip file.
```javascript
// Source: fflate docs (https://github.com/101arrowz/fflate)
import { unzip } from 'fflate';

async function extractZip(arrayBuffer) {
  return new Promise((resolve, reject) => {
    unzip(new Uint8Array(arrayBuffer), (err, result) => {
      if (err) return reject(err);
      // result is { 'path/to/file.txt': Uint8Array, ... }
      const files = Object.entries(result)
        .filter(([name]) => !name.endsWith('/')) // skip directory entries
        .map(([name, data]) => ({ path: '/' + name, data, size: data.length }));
      resolve(files);
    });
  });
}
```

### Pattern 8: TAR.GZ Extraction with nanotar + fflate
**What:** Gunzip then parse tar in browser.
**When to use:** User uploads a .tar.gz file.
```javascript
// Source: nanotar docs (https://github.com/unjs/nanotar) + fflate gunzip
import { parseTar } from 'nanotar';
import { gunzip } from 'fflate';

async function extractTarGz(arrayBuffer) {
  const decompressed = await new Promise((resolve, reject) => {
    gunzip(new Uint8Array(arrayBuffer), (err, data) => err ? reject(err) : resolve(data));
  });
  const entries = parseTar(decompressed);
  return entries
    .filter(e => e.type === 'file')
    .map(e => ({ path: '/' + e.name, data: e.data, size: e.size }));
}
```

### Pattern 9: Directory Picker with Fallback
**What:** showDirectoryPicker (Chromium) with fallback to input[webkitdirectory].
**When to use:** Folder picker button click.
```javascript
async function pickDirectory() {
  if ('showDirectoryPicker' in window) {
    // Chromium: Chrome, Edge, Arc (but NOT Firefox or Safari)
    const dirHandle = await window.showDirectoryPicker();
    return await readDirectoryHandle(dirHandle);
  } else {
    // Firefox/Safari fallback: programmatically click hidden file input
    triggerFallbackFolderInput();
  }
}
```

### Pattern 10: LocalStorage Session Persistence
**What:** Custom Svelte writable store that syncs to localStorage.
**When to use:** Persisting auth session (pubkey, signer type, npub) across page reloads.
```javascript
// Source: Standard Svelte pattern (no external lib needed)
import { writable } from 'svelte/store';

function persistedStore(key, defaultValue) {
  const stored = localStorage.getItem(key);
  const initial = stored ? JSON.parse(stored) : defaultValue;
  const store = writable(initial);
  store.subscribe(value => localStorage.setItem(key, JSON.stringify(value)));
  return store;
}

// Usage:
export const session = persistedStore('nsite_session', { pubkey: null, signerType: null });
```

### Anti-Patterns to Avoid
- **Importing Deno std libs in SPA:** The SPA is pure browser JS. Do NOT use @std/encoding, @std/path, or any Deno import. Use browser equivalents (WebCrypto for hashing, URL for paths).
- **Using esbuild for SPA build:** The SPA uses Vite. Do NOT add the SPA to the existing esbuild-based gateway build.ts.
- **Passing PrivateKeySigner.key (Uint8Array) to localStorage:** Cannot JSON-serialize Uint8Array directly. Convert to hex string for storage; restore with `new Uint8Array(hexToBytes(stored))`.
- **Inlining SPA dist into gateway bundle:** Gateway has 1MB hard limit. SPA should be served as separate static files, not inlined into the bundle.
- **Signing manifest before all uploads succeed:** Publish manifest ONLY after all blobs are confirmed uploaded. Partial manifest = broken site.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP extraction | Custom ZIP parser | `fflate` unzip | ZIP format has complex edge cases: compression methods, ZIP64, central directory parsing, UTF-8 path encoding |
| TAR extraction | Custom TAR parser | `nanotar` + `fflate` gunzip | TAR headers have 512-byte alignment, POSIX/GNU/pax extensions, link types |
| SHA-256 hashing | Manual hash | `crypto.subtle.digest` | Already built into browser; WebCrypto is FIPS-compliant and hardware-accelerated |
| NIP-07 bridging | Direct window.nostr calls | `applesauce-signers ExtensionSigner` | Handles extension missing, async flow, NIP-04/44; already a locked decision |
| NIP-46 state machine | Custom WebSocket handshake | `applesauce-signers NostrConnectSigner` | NIP-46 has complex auth/connect flow, encrypted DMs; already proven in nsyte |
| QR code generation | Canvas pixel manipulation | `qrcode` npm package | Reed-Solomon error correction, format bits, masking patterns — 100+ lines of spec |
| Relay WebSocket communication | Raw WebSocket | `applesauce-relay RelayPool` | Connection lifecycle, reconnect, subscription management, concurrent REQ/CLOSE |

**Key insight:** The nsyte codebase already solved almost all these problems server-side/CLI-side. Port the patterns (not the Deno-specific code) to browser-compatible equivalents.

---

## Common Pitfalls

### Pitfall 1: SPA Build vs. Edge Script Build Pipeline Collision
**What goes wrong:** Developer adds SPA to root `deno.json` workspace or root build task, causing Deno/esbuild to try to process Svelte/Vite files.
**Why it happens:** The monorepo root uses Deno + esbuild for all other apps. SPA is fundamentally different — it needs npm + Vite.
**How to avoid:** Keep `apps/spa/` as a standalone npm project with its own `package.json`. Do NOT add it to `deno.json` workspace array. Add a root `package.json` at monorepo level or document manual build steps separately.
**Warning signs:** `deno check` errors mentioning `.svelte` files; esbuild errors about unknown loaders.

### Pitfall 2: showDirectoryPicker Not Available in Firefox/Safari
**What goes wrong:** Folder picker silently fails or throws in non-Chromium browsers (Firefox, Safari).
**Why it happens:** `showDirectoryPicker` is Chromium-only (Chrome, Edge, Brave, Arc). Firefox has no support as of 2025. Safari has partial support only behind a flag.
**How to avoid:** Feature-detect `'showDirectoryPicker' in window`. Provide `<input type="file" webkitdirectory multiple>` as universal fallback. Show a note to Firefox/Safari users that folder picker is limited.
**Warning signs:** TypeError "showDirectoryPicker is not a function" in Firefox.

### Pitfall 3: Anonymous Deploy nsec — Can't Serialize Uint8Array to localStorage
**What goes wrong:** `PrivateKeySigner.key` is a `Uint8Array`. `JSON.stringify(uint8array)` produces `{"0":x,"1":y,...}` — NOT recoverable as Uint8Array without custom parsing.
**Why it happens:** JSON doesn't have a Uint8Array type. Standard JSON.stringify converts it to an object.
**How to avoid:** Store the key as a hex string: `Array.from(signer.key).map(b=>b.toString(16).padStart(2,'0')).join('')`. Restore with `PrivateKeySigner.fromKey(hexString)`.
**Warning signs:** Session restore creates a signer with wrong pubkey; `signer.key` is an object, not Uint8Array.

### Pitfall 4: NIP-46 QR Code URI — Must Use nostrconnect:// Scheme
**What goes wrong:** Using `bunker://` URI in the QR code instead of `nostrconnect://`.
**Why it happens:** Confusion between the two schemes. `bunker://` is pasted by user; `nostrconnect://` is shown as QR code (the app side).
**How to avoid:** Call `signer.getNostrConnectURI(metadata)` — this returns `nostrconnect://...` (the client's connection offer). `bunker://` comes FROM the remote signer. The QR code shows `nostrconnect://`; the text input accepts `bunker://`.
**Warning signs:** Remote signers can't parse the QR code; connection never completes.

### Pitfall 5: Secret Scanner Text Decoding — Binary Files
**What goes wrong:** Running TextDecoder on binary files (images, fonts, compiled binaries) produces garbage + false positives or throws on invalid UTF-8.
**Why it happens:** Secret scanning regex is designed for text. Binary files are not UTF-8.
**How to avoid:** Check file extension or MIME type before text-scanning. Skip binary extensions: `.png`, `.jpg`, `.gif`, `.webp`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`, `.pdf`, `.zip`, `.gz`, `.tar`, `.wasm`, `.mp4`, `.mp3`. Use try/catch on TextDecoder with `fatal: false`.
**Warning signs:** High false-positive rate; slow scans on large image-heavy sites.

### Pitfall 6: Manifest Publish Before Upload Confirmation
**What goes wrong:** Manifest references SHA-256 hashes for blobs that haven't finished uploading. Gateway serves manifest, tries to fetch blobs, gets 404.
**Why it happens:** Parallel upload + publish without waiting for all uploads to settle.
**How to avoid:** Use `Promise.allSettled` or sequential processing. Only build and publish manifest after confirming all blobs exist (200 response on PUT or 200 on HEAD).
**Warning signs:** Site loads partially; some assets 404.

### Pitfall 7: SPA File Size and Gateway Bundle Limit
**What goes wrong:** If SPA static files are embedded into the gateway Edge Script bundle, the 1MB limit is exceeded immediately.
**Why it happens:** The existing gateway has a 1MB hard limit per INFRA-02. SPA dist (with Tailwind, Svelte, libraries) will easily exceed 200KB.
**How to avoid:** The gateway's `handleSpa` should serve the SPA by forwarding to Bunny Storage or by reading from the CDN edge cache, NOT by inlining HTML/JS into the TypeScript bundle. Treat the SPA dist as static CDN assets separate from the Edge Script.
**Warning signs:** `gateway.bundle.js` exceeds 750KB soft limit after Phase 6.

### Pitfall 8: CORS on Blossom Upload from Browser
**What goes wrong:** Browser fetch to `https://nsite.run/upload` from `https://nsite.run` (same origin) works, but if the blossom is on a subdomain or different URL it fails with CORS error.
**Why it happens:** Browser enforces same-origin policy. Blossom `PUT /upload` must return appropriate CORS headers.
**How to avoid:** Since the SPA and blossom server are both on `nsite.run`, same-origin applies. For user-provided blossom servers in Advanced section, those servers must support CORS. Document this limitation.
**Warning signs:** `Access-Control-Allow-Origin` console errors when uploading.

---

## Code Examples

### Building and Publishing Kind 15128 Manifest via WebSocket
```javascript
// Source: nsyte src/lib/manifest.ts pattern adapted for browser
// Key difference: browser uses native WebSocket, not Deno RelayPool directly
// but applesauce-relay RelayPool works in browser via npm

import { RelayPool } from 'applesauce-relay/pool';

const pool = new RelayPool();

async function publishManifest(signer, files, servers, relays, spaFallback) {
  const indexFile = files.find(f => f.path === '/index.html');
  const pathTags = files.map(f => ['path', f.path, f.sha256]);

  // SPA fallback: add /404.html pointing to index.html sha256
  if (spaFallback && indexFile) {
    pathTags.push(['path', '/404.html', indexFile.sha256]);
  }

  const template = {
    kind: 15128,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ...pathTags,
      ...servers.map(s => ['server', s]),
    ],
    content: '',
  };

  const event = await signer.signEvent(template);

  // Publish to each relay
  for (const relay of relays) {
    await pool.relay(relay).publish(event);
  }
  return event;
}
```

### Secret Scanning — Filename Patterns
```javascript
// Source: synthesized from nsyte DEFAULT_IGNORE_PATTERNS + common secret file lists
// nsyte's secret-detector.ts covers Nostr key formats, not deploy files — build from scratch

const DANGEROUS_FILENAME_PATTERNS = [
  /^\.env(\..+)?$/i,           // .env, .env.local, .env.production
  /^\.env$/i,
  /id_rsa(\.pub)?$/i,          // SSH private keys
  /id_ed25519(\.pub)?$/i,
  /id_ecdsa(\.pub)?$/i,
  /id_dsa(\.pub)?$/i,
  /\.pem$/i,                   // Certificates and private keys
  /\.key$/i,                   // Generic key files
  /\.p12$/i,                   // PKCS12 keystores
  /\.pfx$/i,
  /secrets?\.(json|yaml|yml|toml)$/i,  // Secret config files
  /credentials?\.(json|yaml|yml)$/i,
  /\.aws\/credentials$/i,
  /google-credentials\.json$/i,
  /firebase[- ]?adminsdk.*\.json$/i,
  /service[- ]?account.*\.json$/i,
  /\.htpasswd$/i,
  /wp-config\.php$/i,
];

const AUTO_EXCLUDE_DIR_PATTERNS = ['.git', '.svn', '.hg', '.DS_Store'];

function scanFilename(path) {
  const basename = path.split('/').pop();
  return DANGEROUS_FILENAME_PATTERNS.some(re => re.test(basename));
}
```

### Secret Scanning — Content Patterns
```javascript
// Source: synthesized from common secret patterns (gitleaks, TruffleHog patterns)
// Intentionally conservative — false positives are better than missed secrets

const SECRET_CONTENT_PATTERNS = [
  { name: 'AWS Access Key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', re: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/gi },
  { name: 'GitHub Token', re: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g },
  { name: 'Generic API Key', re: /api[_-]?key\s*[=:]\s*['"]?[A-Za-z0-9]{20,}['"]?/gi },
  { name: 'Private Key Header', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Nostr nsec', re: /nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}/g },
  { name: 'Bearer Token', re: /bearer\s+[A-Za-z0-9\-._~+/]{20,}/gi },
  { name: 'Slack Token', re: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
  { name: 'Stripe Key', re: /sk_live_[0-9a-zA-Z]{24,}/g },
];

async function scanFileContent(arrayBuffer, filename) {
  // Skip binary files
  const binaryExtensions = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|tar|wasm|mp4|mp3|svg|bin)$/i;
  if (binaryExtensions.test(filename)) return [];

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
  } catch { return []; }

  const findings = [];
  for (const { name, re } of SECRET_CONTENT_PATTERNS) {
    if (re.test(text)) findings.push(name);
    re.lastIndex = 0; // reset global regex
  }
  return findings;
}
```

---

## Integration: Gateway SPA Serving (SPA-01)

The gateway's `handleSpaStub` at `apps/gateway/src/stubs/spa.ts` is the hook point. Phase 6 replaces it with a real SPA server. Two viable approaches:

**Option A (Recommended): Serve from Bunny CDN Storage**
Upload the SPA `dist/` files to Bunny Storage during CI/CD. The gateway `handleSpa` proxies root-domain requests to `https://[storage-hostname]/nsite-spa/[path]`. The SPA lives completely outside the Edge Script bundle.

**Option B: Embed SPA in Gateway Bundle**
Use `import.meta.url` + Deno.readTextFile pattern (already used for loading.html) to inline SPA files. RISK: Gateway bundle currently 130.4KB. SPA dist will add 100-300KB, potentially hitting 750KB soft limit. NOT recommended without measuring.

**Current stub** (what Phase 6 replaces):
```typescript
// apps/gateway/src/stubs/spa.ts — current stub returns JSON
export function handleSpaStub(_request: Request): Response {
  return new Response(JSON.stringify({ routed: 'spa', status: 'stub' }), { ... });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NIP-46 text-only URI | NIP-46 with QR code display | 2023-2024 | QR code = zero-friction mobile signer workflow |
| Anonymous user must create Nostr account first | Ephemeral keypair on first visit | 2024 | Removes barrier; nsec export lets user "claim" identity later |
| Single-file upload only | Folder picker + archive upload | 2023 | showDirectoryPicker Chromium API enables full-site deploys |
| ZIP only for archives | ZIP + TAR.GZ | Standard both | TAR.GZ is default output of many site generators |
| Manifest with separate kind | Kind 15128 (root site) | Current NIP draft | 15128 is what this relay accepts per RELAY-01 |

**Deprecated/outdated:**
- Kind 34128: Deprecated nsite format. The relay accepts 15128 and 35128 ONLY. Do not emit 34128.
- applesauce-signers v4.x: nsyte uses v5.1.0. Use v5.x. The 4.x version (found in spryte project) is older.

---

## Open Questions

1. **How does the gateway physically serve SPA static files?**
   - What we know: `handleSpaStub` is already wired at the root domain; it returns a stub JSON response today.
   - What's unclear: Bunny Edge Scripting has no local filesystem access. Static assets must come from Bunny Storage, an external CDN, or be inlined. The 1MB bundle limit makes inlining risky.
   - Recommendation: Plan a separate CI step that uploads `apps/spa/dist/` to Bunny Storage. The `handleSpa` function reads from `BLOSSOM_URL` env var or a dedicated `SPA_ASSETS_URL` env var. This is outside Phase 6 SPA code — it's a gateway integration task.

2. **NIP-46 relay for connection — which relay?**
   - What we know: `NostrConnectSigner` needs relay(s) for the NIP-46 handshake.
   - What's unclear: Using `wss://nsite.run` relay works but the nsite relay is kind-restricted (only accepts 15128, 35128, 10002, 10063). NIP-46 uses kind 24133 (NIP-46 messages) — the nsite relay will REJECT these.
   - Recommendation: Use a general-purpose relay for NIP-46 handshake (e.g., `wss://relay.primal.net`, `wss://relay.damus.io`). Do NOT use `wss://nsite.run` for NIP-46 communication.

3. **User's outbox relays and blossom list — fetch strategy**
   - What we know: After login, fetch kind 10002 (relay list) and kind 10063 (blossom server list) from user's pubkey.
   - What's unclear: Which relay to bootstrap from? The user just logged in; we don't know their relays yet.
   - Recommendation: Use well-known fallback relays for the initial fetch (primal, damus). Once kind 10002 is found, add those relays to the pool. Same pattern as nsyte's `getUserOutboxes()` / `fetchUserRelayList()`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (standard for Vite + Svelte 4 projects) |
| Config file | `apps/spa/vite.config.js` (test section) or `vitest.config.js` |
| Quick run command | `cd apps/spa && npm test -- --run` |
| Full suite command | `cd apps/spa && npm test -- --run --coverage` |

Note: The existing Deno test suite (`deno test --allow-all --recursive`) covers the server-side packages only. SPA tests run separately via Vitest/npm.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPA-07 | Dangerous filenames detected | unit | `npm test -- scanner.test.js -t "filename"` | Wave 0 |
| SPA-08 | Secret content patterns detected | unit | `npm test -- scanner.test.js -t "content"` | Wave 0 |
| SPA-06 | File tree shows correct structure | unit | `npm test -- files.test.js` | Wave 0 |
| SPA-05 | ZIP extraction produces correct file list | unit | `npm test -- files.test.js -t "zip"` | Wave 0 |
| SPA-05 | TAR.GZ extraction produces correct file list | unit | `npm test -- files.test.js -t "tar"` | Wave 0 |
| SPA-09 | Manifest event has correct kind and path tags | unit | `npm test -- publish.test.js` | Wave 0 |
| SPA-10 | BUD-02 auth header format | unit | `npm test -- upload.test.js` | Wave 0 |
| SPA-01 | Gateway serves SPA at root domain | integration/manual | Manual browser test | manual-only |
| SPA-02 | NIP-07 signer login | manual | Manual test with Alby/nos2x | manual-only |
| SPA-03 | NIP-46 remote signer QR flow | manual | Manual test with nsecBunker | manual-only |
| SPA-04 | Folder picker opens | manual | Manual browser test | manual-only |
| SPA-11 | Educational content visible | manual | Manual visual check | manual-only |
| SPA-12 | Tools/resources links present | unit | `npm test -- tools.test.js` | Wave 0 |
| SPA-13 | SPA builds with Svelte | build | `npm run build` exits 0 | build check |

### Wave 0 Gaps
- [ ] `apps/spa/src/lib/scanner.test.js` — covers SPA-07, SPA-08 (filename + content scanning)
- [ ] `apps/spa/src/lib/files.test.js` — covers SPA-05, SPA-06 (archive extraction, file tree)
- [ ] `apps/spa/src/lib/publish.test.js` — covers SPA-09 (manifest event structure)
- [ ] `apps/spa/src/lib/upload.test.js` — covers SPA-10 (BUD-02 auth header)
- [ ] `apps/spa/vitest.config.js` — Vitest config for the SPA app
- [ ] `apps/spa/package.json` — npm project setup (does not exist yet)
- [ ] Framework install: `cd apps/spa && npm install vitest --save-dev`

---

## Sources

### Primary (HIGH confidence)
- Applesauce-signers 5.1.0 type definitions — verified in `/home/sandwich/.cache/deno/npm/registry.npmjs.org/applesauce-signers/5.1.0/dist/signers/` — ExtensionSigner, NostrConnectSigner, PrivateKeySigner APIs
- nsyte codebase — verified in `/home/sandwich/Develop/nsyte/src/` — upload.ts BUD-02 pattern, manifest.ts event template, files.ts ignore patterns, nip46.ts NostrConnectSigner usage
- nsite.run codebase — verified in `/home/sandwich/Develop/nsite.run/` — Svelte 4.2.20 + Vite 5 + Tailwind 3 stack, tools-resources.yaml structure, ToolsResources.svelte component pattern
- nsite.run codebase — verified in `/home/sandwich/Develop/nsite.run/` — handleSpaStub hook, ALLOWED_KINDS constants, manifest kind 15128, gateway bundle 130.4KB current size
- BUD-02 spec (https://github.com/hzrd149/blossom/blob/master/buds/02.md) — Authorization: Nostr base64-event format, kind 24242 upload auth

### Secondary (MEDIUM confidence)
- fflate npm docs — verified via WebSearch cross-referenced with GitHub — `unzip` API for browser ZIP extraction
- nanotar GitHub — verified via WebSearch — `parseTar` API for TAR parsing
- MDN showDirectoryPicker — Chromium-only, not Baseline, requires secure context; Firefox/Safari need fallback
- qrcode npm 1.5.4 — WebSearch + official npm page — browser-compatible QR generation

### Tertiary (LOW confidence — single source)
- Secret content regex patterns — synthesized from multiple open-source scanners (gitleaks, TruffleHog, h33tlit/secret-regex-list); not verified against a single authoritative source. These are STARTER patterns — will need tuning during implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified in local codebases (nsyte, nsite.run) and deno cache
- Architecture: HIGH — patterns directly ported from verified local code
- Pitfalls: HIGH — Pitfalls 1-6 verified from code inspection; Pitfall 7-8 MEDIUM (architectural reasoning)
- Secret scanning patterns: LOW — synthesized from open-source, not battle-tested in this context

**Research date:** 2026-03-17
**Valid until:** 2026-06-01 (stable libraries; Svelte 4 LTS until Svelte 5 adoption is complete)
