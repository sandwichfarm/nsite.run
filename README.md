# nsite.run

The nsite ecosystem directory and reference gateway implementation for [nsite v2](https://github.com/hzrd149/nips/blob/cbe90dbcf7e492c7bc7bf04cd64c84598b435421/nsite.md).

## Contributing to the Software Directory

The best way to contribute is by adding your project to the **nsite software directory**. This is a YAML file that powers the Tools & Resources section on [nsite.run](https://nsite.run):

```
apps/spa/src/lib/tools-resources.yaml
```

### Adding your project

Add an entry under the appropriate category:

```yaml
categories:
  - name: "Gateways"
    items:
      - name: "your-gateway"
        url: "https://github.com/you/your-gateway"
        description: "Short description of what it does"
        versions: [v1]
```

### Categories

| Category | What belongs here |
|----------|-------------------|
| **Gateways** | Services or self-hostable software that serve nsites over HTTP |
| **Deploy Tools** | CLIs, GitHub Actions, or web UIs for publishing nsites |
| **Management Tools** | Dashboards and utilities for managing deployed nsites |
| **Blossom Servers** | Blob storage servers compatible with the Blossom spec |
| **Nsite Dedicated Relays** | Nostr relays optimized for nsite manifest events |
| **Reference** | Protocol specs, NIPs, and foundational documents |
| **Informational** | Curated lists, guides, and educational resources |

### Version tags

Each item can optionally declare which nsite protocol version(s) it supports:

```yaml
versions: [v1]       # supports nsite v1 only (kind 34128)
versions: [v2]       # supports nsite v2 only (kind 15128)
versions: [v1, v2]   # supports both
                      # omit for version-agnostic entries (specs, guides, etc.)
```

The site renders these as filterable tabs so users can find tools compatible with the protocol version they're using.

### Example PR

```yaml
# Under "Deploy Tools"
- name: "my-deploy-tool"
  url: "https://github.com/me/my-deploy-tool"
  description: "Deploy nsites from the command line with NIP-46 support"
  versions: [v1, v2]
```

---

## Architecture Overview

> **Important context:** This implementation exists as a **reference starting point** for nsite v2 so that the new protocol version has infrastructure that "just works" from day one. The goal is to bootstrap v2 adoption, not to be the canonical deployment everyone uses. **Redeploying this same stack to another Bunny CDN does not contribute to decentralization** — the ecosystem benefits when people build independent implementations using different infrastructure, architectures, and hosting providers.

### What this is

A unified nsite hosting stack running on [Bunny Edge Scripting](https://bunny.net/edge-scripting/) at `nsite.run`. It bundles four components into a single domain:

```
nsite.run
├── Relay       wss://nsite.run         NIP-01 relay for nsite event kinds
├── Blossom     https://nsite.run/*     BUD-01/02 blob server for site files
├── Gateway     *.nsite.run             Resolves and serves nsites with progressive caching
└── SPA         https://nsite.run       Web UI for deploying nsites
```

### Relay

A NIP-01 WebSocket relay that accepts only nsite-related event kinds:

- **15128** — site manifest (v2)
- **10002** — relay list (NIP-65)
- **10063** — blossom server list
- **5** — event deletion

Backed by Bunny DB (libSQL). Other gateways and tools can query it via standard nostr protocol.

### Blossom

A BUD-compliant blob server storing files referenced in nsite manifests. Supports:

- `GET /{sha256}` — retrieve blobs
- `PUT /upload` — upload with NIP-98 auth
- `GET /list/{pubkey}` — list blobs by author
- `PUT /mirror` — mirror from URL
- `DELETE /{sha256}` — delete with auth

Backed by Bunny Storage. Files are addressed by SHA-256 hash.

### Gateway

The primary router and nsite resolver. Routes incoming traffic to the relay, blossom, or SPA based on headers and path. For nsite subdomains (`npub1xxx.nsite.run`), it resolves and serves site content using a progressive caching strategy:

1. **Cold cache** — shows a loading page with the user's nostr profile while resolving the manifest in the background
2. **Warm-outdated** — serves cached content immediately, checks for updates in the background, injects an update banner if a newer manifest is found
3. **Warm-current** — serves cached content immediately, background check finds nothing new

Resolved manifests are cached into the relay and blobs into the blossom, so other gateways querying `nsite.run` as a relay/blossom get the benefit of previously resolved content.

### SPA

A Svelte 5 web application at the root domain for deploying nsites. Supports NIP-07 (browser extension) and NIP-46 (Nostr Connect / bunker) authentication. Includes file tree preview, secret scanning (warns about `.env`, private keys, API tokens), and the Tools & Resources directory powered by `tools-resources.yaml`.

## Project Structure

```
nsite-gateway/
├── apps/
│   ├── relay/          # NIP-01 relay edge script
│   ├── blossom/        # BUD blob server edge script
│   ├── gateway/        # Router + nsite resolver edge script
│   └── spa/            # Svelte deploy UI
├── packages/
│   └── shared/         # Shared types and constants
├── scripts/
│   └── check-bundle-sizes.ts
└── .github/workflows/
    ├── ci.yml          # Lint, test, build, size check
    └── deploy.yml      # Deploy to Bunny on push to master
```

## Development

Requires Deno and Node.js (for the SPA).

```bash
# Run all tests
deno task test

# Build all edge script bundles
deno task build

# Type check
deno task check

# Build SPA
cd apps/spa && npm ci && npm run build
```

## Deployment

The stack deploys to Bunny infrastructure via GitHub Actions on push to `master`:

1. **Edge scripts** (relay, blossom, gateway) are bundled with esbuild and deployed via [BunnyWay/actions/deploy-script](https://github.com/BunnyWay/actions)
2. **SPA** is built with Vite and uploaded to Bunny Storage
3. **CDN cache** is purged after SPA upload

Bundle sizes are enforced at 1MB hard limit per edge script (CI fails the build if exceeded).

### Required secrets

| Secret | Purpose |
|--------|---------|
| `BUNNY_API_KEY` | Bunny API access |
| `BUNNY_STORAGE_PASSWORD` | Bunny Storage write access |
| `BUNNY_STORAGE_HOSTNAME` | Storage endpoint hostname |
| `BUNNY_STORAGE_USERNAME` | Storage zone name |
| `BUNNY_GATEWAY_PULLZONE_ID` | Pull zone for cache purge |
| `BUNNY_RELAY_SCRIPT_ID` / `_DEPLOY_KEY` | Relay edge script credentials |
| `BUNNY_BLOSSOM_SCRIPT_ID` / `_DEPLOY_KEY` | Blossom edge script credentials |
| `BUNNY_GATEWAY_SCRIPT_ID` / `_DEPLOY_KEY` | Gateway edge script credentials |

### Running your own

If you want to run independent nsite infrastructure (which is great for decentralization!), consider building your own implementation rather than forking this one. The [nsite v2 spec](https://github.com/hzrd149/nips/blob/cbe90dbcf7e492c7bc7bf04cd64c84598b435421/nsite.md), [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md), and [Blossom spec](https://github.com/hzrd149/blossom) are the interfaces that matter — the implementation behind them is up to you. Use any language, any hosting provider, any architecture. That's the point.
