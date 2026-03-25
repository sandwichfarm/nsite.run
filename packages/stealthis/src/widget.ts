import { STYLES } from './styles';
import * as nostr from './nostr';
import { toSvg } from './qr';
import {
  hasExtension,
  extensionSigner,
  bunkerConnect,
  prepareNostrConnect,
  DEFAULT_NIP46_RELAY,
  type Signer
} from './signer';

type State =
  | 'idle'
  | 'auth'
  | 'connecting'
  | 'loading'
  | 'form'
  | 'confirm'
  | 'deploying'
  | 'success'
  | 'error';

export class NsiteDeployButton extends HTMLElement {
  static observedAttributes = ['button-text', 'stat-text', 'no-trail', 'obfuscate-npubs', 'do-not-fetch-muse-data'];

  private shadow: ShadowRoot;
  private state: State = 'idle';
  private ctx: nostr.NsiteContext | null = null;
  private manifest: nostr.SignedEvent | null = null;
  private signer: Signer | null = null;
  private userPubkey = '';
  private userRelays: string[] = [];
  private deployedUrl = '';
  private errorMsg = '';
  private statusMsg = '';
  private slug = '';
  private siteTitle = '';
  private siteDescription = '';
  private deployAsRoot = true;
  private hasRootSite: boolean | null = null; // null = still checking
  private nostrConnectUri = '';
  private nip46Relay = DEFAULT_NIP46_RELAY;
  private qrAbort: AbortController | null = null;
  private ncConnect: ReturnType<typeof prepareNostrConnect> | null = null;
  private manifestPromise: Promise<nostr.SignedEvent | null> | null = null;
  private relaysPromise: Promise<string[]> | null = null;
  private muses: nostr.Muse[] = [];
  private museProfiles = new Map<string, nostr.MuseProfile>();
  private musesExpanded = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.ctx = nostr.parseContext();
    if (this.ctx) {
      this.manifestPromise = nostr.fetchManifest(this.ctx);
      if (!this.hasAttribute('no-trail')) {
        this.manifestPromise.then((manifest) => {
          if (manifest) {
            this.muses = nostr.extractMuses(manifest);
            if (this.muses.length > 0 && this.state === 'idle') this.render();
            // Start streaming profile enrichment unless opted out
            if (
              this.muses.length > 0 &&
              !this.hasAttribute('do-not-fetch-muse-data') &&
              !this.hasAttribute('obfuscate-npubs')
            ) {
              nostr.fetchMuseProfiles(this.muses, this.ctx!.baseDomain, (pubkey, profile) => {
                this.museProfiles.set(pubkey, profile);
                if (this.state === 'idle' && this.musesExpanded) this.render();
              });
            }
          }
        });
      }
      this.render();
    }
  }

  attributeChangedCallback() {
    if (this.state === 'idle') this.render();
  }

  private get buttonText(): string {
    return this.getAttribute('button-text') || 'Borrow this nsite';
  }

  private get statText(): string {
    return this.getAttribute('stat-text') || '%s npubs borrowed this nsite';
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private modal(body: string): string {
    return `<div class="nd-overlay"><div class="nd-modal">${body}</div></div>`;
  }

  private render() {
    this.preserveFormValues();
    let html = `<style>${STYLES}</style>`;

    switch (this.state) {
      case 'idle':
        html += `<button class="nd-trigger" part="trigger">${this.esc(this.buttonText)}</button>`;
        html += this.paperTrailContent();
        break;

      case 'auth':
        html += `<button class="nd-trigger" disabled>${this.esc(this.buttonText)}</button>`;
        html += this.modal(this.authContent());
        break;

      case 'connecting':
        html += `<button class="nd-trigger" disabled>Connecting...</button>`;
        html += this.modal(`
          <div class="nd-header">
            <h2 class="nd-title">Connecting</h2>
            <button class="nd-close" data-action="close">&times;</button>
          </div>
          <div class="nd-msg"><span class="nd-spinner"></span>${this.esc(this.statusMsg)}</div>
        `);
        break;

      case 'loading':
        html += `<button class="nd-trigger" disabled>Loading...</button>`;
        html += this.modal(`
          <div class="nd-msg"><span class="nd-spinner"></span>Fetching site manifest...</div>
        `);
        break;

      case 'form':
        html += `<button class="nd-trigger" disabled>${this.esc(this.buttonText)}</button>`;
        html += this.modal(this.formContent());
        break;

      case 'confirm':
        html += `<button class="nd-trigger" disabled>${this.esc(this.buttonText)}</button>`;
        html += this.modal(this.confirmContent());
        break;

      case 'deploying':
        html += `<button class="nd-trigger" disabled>Deploying...</button>`;
        html += this.modal(`
          <h2 class="nd-title">Deploying</h2>
          <div class="nd-msg"><span class="nd-spinner"></span>${this.esc(this.statusMsg)}</div>
        `);
        break;

      case 'success':
        html += `<button class="nd-trigger" disabled>Deployed!</button>`;
        html += this.modal(`
          <div class="nd-header">
            <h2 class="nd-title">Deployed!</h2>
            <button class="nd-close" data-action="close">&times;</button>
          </div>
          <div class="nd-status nd-status-ok">Your site is live</div>
          <a class="nd-link" href="${this.esc(this.deployedUrl)}" target="_blank" rel="noopener">${this.esc(this.deployedUrl)}</a>
          <div class="nd-actions">
            <button class="nd-btn nd-btn-secondary" data-action="close">Close</button>
          </div>
        `);
        break;

      case 'error':
        html += `<button class="nd-trigger" part="trigger">${this.esc(this.buttonText)}</button>`;
        html += this.modal(`
          <div class="nd-header">
            <h2 class="nd-title">Error</h2>
            <button class="nd-close" data-action="close">&times;</button>
          </div>
          <div class="nd-status nd-status-err">${this.esc(this.errorMsg)}</div>
          <div class="nd-actions">
            <button class="nd-btn nd-btn-secondary" data-action="close">Close</button>
          </div>
        `);
        break;
    }

    this.shadow.innerHTML = html;
    this.bind();
  }

  // --- Content builders ---

  private paperTrailContent(): string {
    if (this.hasAttribute('no-trail') || this.muses.length === 0) return '';

    let html = `<div class="nd-trail">
      <button class="nd-trail-toggle" data-action="toggle-trail">${this.esc(this.statText.replace('%s', String(this.muses.length)))}</button>`;

    if (this.musesExpanded) {
      html += `<div class="nd-trail-list">`;
      const first = this.muses[0];
      const second = this.muses.length > 1 ? this.muses[1] : null;

      // Show originator
      html += this.museItem(first);

      // Show gap if indices aren't sequential (truncated middle)
      if (second && second.index > first.index + 1) {
        const truncated = second.index - first.index - 1;
        html += `<div class="nd-trail-gap">... ${truncated} more</div>`;
      }

      // Show the rest
      for (let i = 1; i < this.muses.length; i++) {
        html += this.museItem(this.muses[i]);
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  private museItem(muse: nostr.Muse): string {
    const npub = nostr.npubEncode(muse.pubkey);

    // obfuscate-npubs: truncated npub, no link (legacy behavior)
    if (this.hasAttribute('obfuscate-npubs')) {
      const short = npub.slice(0, 12) + '...' + npub.slice(-4);
      return `<div class="nd-trail-item">
        <span class="nd-trail-idx">#${muse.index}</span>
        <span class="nd-trail-pk">${short}</span>
      </div>`;
    }

    // do-not-fetch-muse-data (without obfuscate): full npub linked to njump
    if (this.hasAttribute('do-not-fetch-muse-data')) {
      return `<div class="nd-trail-item">
        <span class="nd-trail-idx">#${muse.index}</span>
        <a class="nd-trail-link" href="https://njump.me/${this.esc(npub)}" target="_blank" rel="noopener">${this.esc(npub)}</a>
      </div>`;
    }

    // Default: enriched display — name + link to nsite or njump
    const profile = this.museProfiles.get(muse.pubkey);
    const displayName = profile?.name || npub;
    const href = profile?.nsiteUrl || `https://njump.me/${npub}`;
    return `<div class="nd-trail-item">
      <span class="nd-trail-idx">#${muse.index}</span>
      <a class="nd-trail-link" href="${this.esc(href)}" target="_blank" rel="noopener">${this.esc(displayName)}</a>
    </div>`;
  }

  private authContent(): string {
    const ext = hasExtension();
    const qrSvg = this.nostrConnectUri ? toSvg(this.nostrConnectUri) : '';

    let html = `
      <div class="nd-header">
        <h2 class="nd-title">Sign In</h2>
        <button class="nd-close" data-action="close">&times;</button>
      </div>`;

    if (ext) {
      html += `
        <div class="nd-auth-option">
          <button class="nd-btn-ext" data-action="ext">Sign in with Extension</button>
        </div>
        <div class="nd-divider">or</div>`;
    }

    html += `
      <div class="nd-auth-option">
        <div class="nd-qr-label" style="margin-bottom:6px">Paste a bunker URI</div>
        <div class="nd-bunker-row">
          <input type="text" placeholder="bunker://..." id="nd-bunker" />
          <button data-action="bunker">Connect</button>
        </div>
      </div>
      <div class="nd-divider">or scan</div>
      <div class="nd-auth-option">
        <div class="nd-qr-wrap">
          <div class="nd-qr-label">Scan with your signer app</div>
          <div class="nd-qr-code">${qrSvg}</div>
          <div class="nd-relay-row">
            <label>relay</label>
            <input type="text" id="nd-nip46-relay" value="${this.esc(this.nip46Relay)}" />
          </div>
          <div class="nd-qr-uri">
            <input readonly value="${this.esc(this.nostrConnectUri)}" id="nd-nc-uri" />
            <button data-action="copy-uri">Copy</button>
          </div>
        </div>
      </div>`;

    return html;
  }

  private formContent(): string {
    let html = `
      <div class="nd-header">
        <h2 class="nd-title">Deploy this Page</h2>
        <button class="nd-close" data-action="close">&times;</button>
      </div>
      ${this.hasRootSite ? `<div class="nd-toggle">
        <button class="nd-toggle-btn ${this.deployAsRoot ? 'active' : ''}" data-action="type-root">Root Site</button>
        <button class="nd-toggle-btn ${!this.deployAsRoot ? 'active' : ''}" data-action="type-named">Named Site</button>
      </div>` : ''}`;

    if (this.deployAsRoot) {
      html += `<div class="nd-root-hint">Your primary site, served at your npub subdomain.</div>`;
    } else {
      html += `
        <div class="nd-root-hint">A sub-site with its own name, served alongside your root site.</div>
        <div class="nd-field">
          <label for="nd-slug">Site name</label>
          <input id="nd-slug" type="text" placeholder="my-site" value="${this.esc(this.slug)}" maxlength="13" autocomplete="off" />
          <div class="nd-hint">Lowercase a-z, 0-9, hyphens. 1-13 chars.</div>
          <div class="nd-field-error" id="nd-slug-err"></div>
        </div>`;
    }

    html += `
      <div class="nd-field">
        <label for="nd-title">Title</label>
        <input id="nd-title" type="text" placeholder="Optional" value="${this.esc(this.siteTitle)}" />
      </div>
      <div class="nd-field">
        <label for="nd-desc">Description</label>
        <textarea id="nd-desc" placeholder="Optional">${this.esc(this.siteDescription)}</textarea>
      </div>
      <div class="nd-actions">
        <button class="nd-btn nd-btn-secondary" data-action="close">Cancel</button>
        <button class="nd-btn nd-btn-primary" data-action="deploy" ${this.hasRootSite === null ? 'disabled' : ''}>
          ${this.hasRootSite === null ? '<span class="nd-spinner"></span>Checking...' : 'Deploy'}
        </button>
      </div>`;

    return html;
  }

  private confirmContent(): string {
    const what = this.deployAsRoot ? 'a root site' : `a site named "${this.esc(this.slug)}"`;
    return `
      <div class="nd-header">
        <h2 class="nd-title">Site Already Exists</h2>
        <button class="nd-close" data-action="close">&times;</button>
      </div>
      <div class="nd-warn">
        You already have ${what}. Deploying will replace it with this page's content.
      </div>
      <div class="nd-actions">
        <button class="nd-btn nd-btn-secondary" data-action="back">Back</button>
        <button class="nd-btn nd-btn-warn" data-action="confirm-deploy">Overwrite</button>
      </div>`;
  }

  // --- Bindings ---

  private bind() {
    this.shadow
      .querySelector('.nd-trigger:not([disabled])')
      ?.addEventListener('click', () => this.open());
    this.shadow
      .querySelectorAll('[data-action="close"]')
      .forEach((el) => el.addEventListener('click', () => this.close()));
    this.shadow
      .querySelector('[data-action="deploy"]')
      ?.addEventListener('click', () => this.onDeploy());
    this.shadow
      .querySelector('[data-action="confirm-deploy"]')
      ?.addEventListener('click', () => this.executeDeploy());
    this.shadow
      .querySelector('[data-action="back"]')
      ?.addEventListener('click', () => this.setState('form'));
    this.shadow
      .querySelector('[data-action="ext"]')
      ?.addEventListener('click', () => this.authExtension());
    this.shadow
      .querySelector('[data-action="bunker"]')
      ?.addEventListener('click', () => this.authBunker());
    this.shadow
      .querySelector('[data-action="copy-uri"]')
      ?.addEventListener('click', () => this.copyUri());
    this.shadow
      .querySelector('[data-action="toggle-trail"]')
      ?.addEventListener('click', () => {
        this.musesExpanded = !this.musesExpanded;
        this.render();
      });
    this.shadow
      .querySelector('[data-action="type-named"]')
      ?.addEventListener('click', () => {
        this.deployAsRoot = false;
        this.setState('form');
      });
    this.shadow
      .querySelector('[data-action="type-root"]')
      ?.addEventListener('click', () => {
        this.deployAsRoot = true;
        this.setState('form');
      });
    this.shadow.querySelector('.nd-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('nd-overlay')) this.close();
    });

    // Relay editing — regenerate QR on blur or Enter
    const relayInput = this.shadow.querySelector('#nd-nip46-relay') as HTMLInputElement | null;
    if (relayInput) {
      const commitRelay = () => {
        const v = relayInput.value.trim();
        if (v && v !== this.nip46Relay) {
          this.nip46Relay = v;
          this.startNostrConnect();
        }
      };
      relayInput.addEventListener('blur', commitRelay);
      relayInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitRelay();
        }
      });
    }
  }

  private preserveFormValues() {
    if (this.state !== 'form') return;
    const slug = this.shadow.querySelector('#nd-slug') as HTMLInputElement | null;
    const title = this.shadow.querySelector('#nd-title') as HTMLInputElement | null;
    const desc = this.shadow.querySelector('#nd-desc') as HTMLTextAreaElement | null;
    if (slug) this.slug = slug.value;
    if (title) this.siteTitle = title.value;
    if (desc) this.siteDescription = desc.value;
  }

  private setState(s: State) {
    this.state = s;
    this.render();
  }

  private close() {
    this.cancelQr();
    this.signer?.close();
    this.signer = null;
    this.setState('idle');
  }

  private cancelQr() {
    this.qrAbort?.abort();
    this.qrAbort = null;
    this.ncConnect = null;
  }

  private showError(msg: string) {
    this.errorMsg = msg;
    this.setState('error');
  }

  // --- Nostrconnect lifecycle ---

  private startNostrConnect() {
    this.cancelQr();

    this.ncConnect = prepareNostrConnect(this.nip46Relay);
    this.nostrConnectUri = this.ncConnect.uri;

    // Re-render to show new QR (only if we're on the auth screen)
    if (this.state === 'auth') {
      this.render();
    }

    // Listen for connection in background
    this.qrAbort = new AbortController();
    this.ncConnect
      .connect(this.qrAbort.signal)
      .then((signer) => {
        if (this.state === 'auth' || this.state === 'connecting') {
          this.signer = signer;
          this.onAuthenticated();
        } else {
          signer.close();
        }
      })
      .catch(() => {
        // Aborted or timed out
      });
  }

  // --- Auth ---

  private async open() {
    // Manifest fetch started in constructor; ensure it's running
    if (!this.manifestPromise && this.ctx) {
      this.manifestPromise = nostr.fetchManifest(this.ctx);
    }

    this.state = 'auth';
    this.startNostrConnect();
  }

  private async authExtension() {
    this.cancelQr();
    try {
      this.signer = extensionSigner();
      this.onAuthenticated();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private async authBunker() {
    const input = (this.shadow.querySelector('#nd-bunker') as HTMLInputElement)?.value.trim();
    if (!input) return;

    this.cancelQr();
    this.statusMsg = 'Connecting to bunker...';
    this.setState('connecting');

    try {
      this.signer = await bunkerConnect(input);
      this.onAuthenticated();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private async copyUri() {
    try {
      await navigator.clipboard.writeText(this.nostrConnectUri);
      const btn = this.shadow.querySelector('[data-action="copy-uri"]') as HTMLButtonElement;
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => {
          if (btn.isConnected) btn.textContent = 'Copy';
        }, 2000);
      }
    } catch {
      /* clipboard unavailable */
    }
  }

  // --- Post-auth ---

  private async onAuthenticated() {
    this.setState('loading');

    try {
      this.userPubkey = await this.signer!.getPublicKey();
      this.manifest = (await this.manifestPromise) as nostr.SignedEvent | null;

      if (!this.manifest) {
        this.showError('Could not find the site manifest on any relay.');
        return;
      }

      this.siteTitle = '';
      this.siteDescription = '';
      this.slug = this.ctx!.identifier ?? '';
      this.deployAsRoot = true;
      this.hasRootSite = null;

      // Show form immediately — don't block on relay discovery
      this.setState('form');

      // Background: fetch relays, then check if root site exists
      this.relaysPromise = nostr.getWriteRelays(this.userPubkey);
      this.relaysPromise.then(async (relays) => {
        this.userRelays = relays;
        const hasRoot = await nostr.checkExistingSite(relays, this.userPubkey);
        this.hasRootSite = hasRoot;
        if (hasRoot && this.state === 'form' && this.deployAsRoot) {
          this.deployAsRoot = false;
        }
        if (this.state === 'form') this.render();
      });
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  // --- Deploy ---

  private readFormValues() {
    if (!this.deployAsRoot) {
      const slugEl = this.shadow.querySelector('#nd-slug') as HTMLInputElement | null;
      if (slugEl) this.slug = slugEl.value.trim();
    }
    const titleEl = this.shadow.querySelector('#nd-title') as HTMLInputElement | null;
    const descEl = this.shadow.querySelector('#nd-desc') as HTMLTextAreaElement | null;
    if (titleEl) this.siteTitle = titleEl.value.trim();
    if (descEl) this.siteDescription = descEl.value.trim();
  }

  private async onDeploy() {
    this.readFormValues();

    if (!this.deployAsRoot) {
      const errEl = this.shadow.querySelector('#nd-slug-err') as HTMLElement;
      if (!this.slug) {
        errEl.textContent = 'Site name is required';
        return;
      }
      if (!nostr.isValidDTag(this.slug)) {
        errEl.textContent = 'Lowercase a-z, 0-9, hyphens only. Cannot end with hyphen.';
        return;
      }
    }

    this.statusMsg = 'Checking for existing site...';
    this.setState('deploying');

    try {
      // Ensure relays are ready (usually already resolved by now)
      if (this.relaysPromise) {
        this.userRelays = await this.relaysPromise;
      }
      if (this.userRelays.length === 0) {
        this.userRelays = await nostr.getWriteRelays(this.userPubkey);
      }

      const slug = this.deployAsRoot ? undefined : this.slug;
      const exists = await nostr.checkExistingSite(this.userRelays, this.userPubkey, slug);

      if (exists) {
        this.setState('confirm');
        return;
      }

      await this.executeDeploy();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private async executeDeploy() {
    this.statusMsg = 'Creating event...';
    this.setState('deploying');

    try {
      const slug = this.deployAsRoot ? undefined : this.slug;
      const unsigned = nostr.createDeployEvent(this.manifest!, {
        slug,
        title: this.siteTitle || undefined,
        description: this.siteDescription || undefined,
        deployerPubkey: this.userPubkey,
        deployerRelays: this.userRelays,
        noTrail: this.hasAttribute('no-trail')
      });

      this.statusMsg = 'Waiting for signature...';
      this.render();
      const signed = await this.signer!.signEvent(unsigned);

      this.statusMsg = `Publishing to ${this.userRelays.length} relay${this.userRelays.length === 1 ? '' : 's'}...`;
      this.render();
      const published = await nostr.publishToRelays(this.userRelays, signed);

      if (published === 0) {
        this.showError('Failed to publish to any relay. Please try again.');
        return;
      }

      this.deployedUrl = nostr.buildSiteUrl(this.ctx!.baseDomain, this.userPubkey, slug);
      this.setState('success');
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }
}
