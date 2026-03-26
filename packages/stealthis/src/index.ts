import { NsiteDeployButton } from './widget';

customElements.define('steal-this', NsiteDeployButton);

function autoInject() {
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
