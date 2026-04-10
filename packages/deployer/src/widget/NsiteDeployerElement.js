import { STYLES } from './styles.js';
import DeployerWidget from '../components/DeployerWidget.svelte';

const FORWARDED_EVENTS = [
  'deploy-success', 'deploy-error', 'auth-change',
  'operation-start', 'operation-end', 'site-deleted'
];

export class NsiteDeployerElement extends HTMLElement {
  static observedAttributes = [
    'trigger-label', 'trigger-color', 'trigger-bg',
    'default-relay', 'default-blossom'
  ];

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._svelteInstance = null;
    this._isOpen = false;
    this._extraRelays = [];
    this._extraBlossoms = [];
    this._signer = null;
    this._onKeydown = this._handleKeydown.bind(this);
  }

  connectedCallback() {
    this._renderTrigger();
  }

  disconnectedCallback() {
    if (this._isOpen) {
      this._closeModal();
    }
    if (this._svelteInstance) {
      this._svelteInstance.$destroy();
      this._svelteInstance = null;
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    if (name === 'trigger-label' && !this._isOpen) {
      this._renderTrigger();
    }
    if (name === 'trigger-color') {
      this.style.setProperty('--nsd-trigger-color', newVal);
    }
    if (name === 'trigger-bg') {
      this.style.setProperty('--nsd-trigger-bg', newVal);
    }
    if ((name === 'default-relay' || name === 'default-blossom') && this._svelteInstance) {
      const camelName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this._svelteInstance.$set({ [camelName]: newVal });
    }
  }

  // --- JS Properties (getter/setter pairs) ---

  get extraRelays() { return this._extraRelays; }
  set extraRelays(v) {
    this._extraRelays = Array.isArray(v) ? v : [];
    if (this._svelteInstance) {
      this._svelteInstance.$set({ extraRelays: this._extraRelays });
    }
  }

  get extraBlossoms() { return this._extraBlossoms; }
  set extraBlossoms(v) {
    this._extraBlossoms = Array.isArray(v) ? v : [];
    if (this._svelteInstance) {
      this._svelteInstance.$set({ extraBlossoms: this._extraBlossoms });
    }
  }

  get signer() { return this._signer; }
  set signer(v) {
    this._signer = v;
    if (this._svelteInstance) {
      this._svelteInstance.$set({ signer: v });
    }
  }

  // --- Internal rendering ---

  get _triggerLabel() {
    return this.getAttribute('trigger-label') || 'Deploy to nsite';
  }

  _renderTrigger() {
    this._shadow.innerHTML =
      `<style>${STYLES}</style>` +
      `<button class="nsd-trigger">${this._escapeHtml(this._triggerLabel)}</button>`;

    const btn = this._shadow.querySelector('.nsd-trigger');
    if (btn) {
      btn.addEventListener('click', () => this._openModal());
    }
  }

  _openModal() {
    if (this._isOpen) return;
    this._isOpen = true;

    this._shadow.innerHTML =
      `<style>${STYLES}</style>` +
      `<button class="nsd-trigger" disabled>${this._escapeHtml(this._triggerLabel)}</button>` +
      `<div class="nsd-overlay">` +
        `<div class="nsd-modal">` +
          `<button class="nsd-close">&times;</button>` +
          `<div class="nsd-mount"></div>` +
        `</div>` +
      `</div>`;

    // Backdrop close
    const overlay = this._shadow.querySelector('.nsd-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target.classList.contains('nsd-overlay')) {
          this._closeModal();
        }
      });
    }

    // Close button
    const closeBtn = this._shadow.querySelector('.nsd-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeModal());
    }

    // Escape key
    document.addEventListener('keydown', this._onKeydown);

    // Mount DeployerWidget
    const mountPoint = this._shadow.querySelector('.nsd-mount');
    this._svelteInstance = new DeployerWidget({
      target: mountPoint,
      props: {
        signer: this._signer,
        extraRelays: this._extraRelays,
        extraBlossoms: this._extraBlossoms,
        defaultRelay: this.getAttribute('default-relay') || undefined,
        defaultBlossom: this.getAttribute('default-blossom') || undefined,
      }
    });

    // Event forwarding
    FORWARDED_EVENTS.forEach(eventName => {
      this._svelteInstance.$on(eventName, (e) => {
        this.dispatchEvent(new CustomEvent(eventName, {
          detail: e.detail,
          bubbles: true,
          composed: true
        }));
      });
    });
  }

  _closeModal() {
    if (!this._isOpen) return;
    this._isOpen = false;

    if (this._svelteInstance) {
      this._svelteInstance.$destroy();
      this._svelteInstance = null;
    }

    document.removeEventListener('keydown', this._onKeydown);
    this._renderTrigger();
  }

  _handleKeydown(e) {
    if (e.key === 'Escape') {
      this._closeModal();
    }
  }

  _escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
