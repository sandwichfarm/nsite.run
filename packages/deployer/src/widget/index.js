import { NsiteDeployerElement } from './NsiteDeployerElement.js';

// Register custom element if not already defined (safe for multiple script loads)
if (!customElements.get('nsite-deployer')) {
  customElements.define('nsite-deployer', NsiteDeployerElement);
}

// Export for ESM consumers
export { NsiteDeployerElement };
export const VERSION = '0.1.0';
