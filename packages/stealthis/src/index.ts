/**
 * @module
 *
 * `@nsite/stealthis` — a drop-in web component that lets visitors re-publish
 * (borrow) the current nsite to their own Nostr identity. Importing this
 * module for side effects registers the `<steal-this>` custom element and
 * auto-injects a floating trigger into the page if one is not already
 * present.
 *
 * ```html
 * <script type="module" src="https://jsr.io/@nsite/stealthis"></script>
 * <!-- <steal-this> element is now available; auto-injected if omitted -->
 * ```
 *
 * Or, from a bundler:
 * ```ts
 * import '@nsite/stealthis';
 * // <steal-this> custom element is registered as a side effect.
 * ```
 *
 * The {@link NsiteDeployButton} class is exported for consumers who want to
 * subclass or manually register the element with a non-default tag name.
 */

import { NsiteDeployButton } from './widget';

export { NsiteDeployButton } from './widget';

customElements.define('steal-this', NsiteDeployButton);

function autoInject(): void {
  if (!document.querySelector('steal-this')) {
    const el = document.createElement('steal-this');
    el.classList.add('nd-fixed');
    document.body.appendChild(el);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInject);
} else {
  autoInject();
}
