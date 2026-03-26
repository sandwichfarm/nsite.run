export const STYLES = /*css*/ `
  :host {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: inline-block;
  }

  .nsd-trigger {
    padding: 10px 18px;
    background: var(--nsd-trigger-bg, #7c3aed);
    color: var(--nsd-trigger-color, #fff);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .nsd-trigger:hover { background: #6d28d9; }
  .nsd-trigger:disabled { opacity: 0.6; cursor: default; }

  .nsd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
    backdrop-filter: blur(4px);
  }

  .nsd-modal {
    background: #1a1a2e;
    border: 1px solid #0f3460;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .nsd-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: #888;
    font-size: 22px;
    cursor: pointer;
    z-index: 1;
    line-height: 1;
    padding: 4px 8px;
  }
  .nsd-close:hover { color: #e0e0e0; }

  .nsd-mount {
    width: 100%;
  }
`;
