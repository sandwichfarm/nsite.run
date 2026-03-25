# @nsite/stealthis

A drop-in web component that adds a "Borrow this" button to any nsite. Visitors can deploy a copy of the current page to their own nostr identity with one click.

## How it works

When loaded on an nsite, `<nsite-deploy>` detects the site owner's pubkey from the subdomain, fetches the site manifest from nostr relays, and lets authenticated visitors publish a copy under their own npub. Each deployment appends a `muse` tag to the manifest, creating a paper trail of who was inspired by the site.

## Install

```js
import '@nsite/stealthis';
```

The widget auto-injects a fixed-position button in the bottom-right corner.

## Manual placement

If you want to control where the button appears, add the element yourself (the auto-inject will skip if one already exists):

```html
<nsite-deploy button-text="Cop this joint" stat-text="%s npubs copped this"></nsite-deploy>
```

## Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `button-text` | `"Borrow this nsite"` | Button text |
| `stat-text` | `"%s npubs borrowed this nsite"` | Paper trail summary. `%s` is replaced with the count. |
| `no-trail` | _(absent)_ | Boolean attribute. When present, hides the paper trail. |

The button's `trigger` part is exposed via `::part(trigger)` for CSS customization.

## Authentication

The widget supports three sign-in methods:

- **NIP-07** - Browser extension (e.g. nos2x, Alby)
- **NIP-46 Bunker URI** - Paste a `bunker://` connection string
- **NIP-46 QR / Nostr Connect** - Scan a QR code with a signer app

## Deploy options

- **Root site** - Publishes as the visitor's primary nsite (kind `15128`)
- **Named site** - Publishes as a named sub-site with a slug (kind `35128`)

If the visitor already has a root site, the form defaults to a named site. Overwriting an existing site requires explicit confirmation.

## Paper trail

Each deployment adds a `muse` tag with the deployer's pubkey and relay list. The widget shows an expandable "Inspired N npubs" counter when muse tags are present. A maximum of 9 muse tags are kept per manifest (originator + 8 most recent), with FIFO truncation of the middle.

## Development

```bash
pnpm install
pnpm run build    # builds dist/stealthis.js (IIFE) and dist/stealthis.mjs (ESM)
pnpm run dev      # watch mode
```

## License

MIT
