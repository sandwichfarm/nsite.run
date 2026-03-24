import { NsiteDeployButton } from './widget';

customElements.define('nsite-deploy', NsiteDeployButton);

function autoInject() {
  if (!document.querySelector('nsite-deploy')) {
    const el = document.createElement('nsite-deploy');
    el.classList.add('nd-fixed');
    document.body.appendChild(el);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInject);
} else {
  autoInject();
}
