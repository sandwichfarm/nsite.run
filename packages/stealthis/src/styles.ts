export const STYLES = /*css*/ `
  :host {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .nd-trigger {
    padding: 10px 18px;
    background: #9b59b6;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .nd-trigger:hover { background: #8e44ad; }
  .nd-trigger:disabled { opacity: 0.6; cursor: default; }
  :host(.nd-fixed) .nd-trigger {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99999;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
  }

  .nd-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100000;
    backdrop-filter: blur(4px);
  }

  .nd-modal {
    background: #1a1a2e;
    border: 1px solid #0f3460;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 420px;
    color: #e0e0e0;
    max-height: 90vh;
    overflow-y: auto;
  }

  .nd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .nd-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }
  .nd-close {
    background: none;
    border: none;
    color: #888;
    font-size: 22px;
    cursor: pointer;
    padding: 0 0 0 8px;
    line-height: 1;
  }
  .nd-close:hover { color: #e0e0e0; }

  /* Auth section */
  .nd-auth-option {
    margin-bottom: 16px;
  }
  .nd-auth-option:last-child {
    margin-bottom: 0;
  }

  .nd-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 16px 0;
    font-size: 12px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .nd-divider::before, .nd-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #0f3460;
  }

  .nd-btn-ext {
    width: 100%;
    padding: 12px;
    background: #9b59b6;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .nd-btn-ext:hover { background: #8e44ad; }

  .nd-bunker-row {
    display: flex;
    gap: 8px;
  }
  .nd-bunker-row input {
    flex: 1;
    padding: 8px 12px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    min-width: 0;
  }
  .nd-bunker-row input:focus {
    outline: none;
    border-color: #9b59b6;
  }
  .nd-bunker-row button {
    padding: 8px 14px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .nd-bunker-row button:hover { background: #0f3460; }

  .nd-qr-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .nd-qr-label {
    font-size: 12px;
    color: #888;
  }
  .nd-qr-code {
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    display: inline-flex;
  }
  .nd-qr-code svg {
    display: block;
    width: 200px;
    height: 200px;
  }
  .nd-relay-row {
    display: flex;
    gap: 0;
    width: 100%;
    max-width: 300px;
  }
  .nd-relay-row label {
    padding: 6px 10px;
    background: #0f3460;
    border: 1px solid #0f3460;
    border-right: none;
    border-radius: 4px 0 0 4px;
    color: #888;
    font-size: 11px;
    white-space: nowrap;
    display: flex;
    align-items: center;
  }
  .nd-relay-row input {
    flex: 1;
    padding: 6px 8px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 0 4px 4px 0;
    color: #e0e0e0;
    font-size: 11px;
    font-family: monospace;
    min-width: 0;
    box-sizing: border-box;
  }
  .nd-relay-row input:focus {
    outline: none;
    border-color: #9b59b6;
  }
  .nd-qr-uri {
    display: flex;
    gap: 6px;
    width: 100%;
    max-width: 300px;
  }
  .nd-qr-uri input {
    flex: 1;
    padding: 6px 8px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 4px;
    color: #888;
    font-size: 11px;
    font-family: monospace;
    min-width: 0;
    box-sizing: border-box;
  }
  .nd-qr-uri button {
    padding: 6px 10px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }
  .nd-qr-uri button:hover { background: #0f3460; }

  /* Toggle */
  .nd-toggle {
    display: flex;
    margin-bottom: 16px;
    background: #16213e;
    border-radius: 6px;
    padding: 3px;
  }
  .nd-toggle-btn {
    flex: 1;
    padding: 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #888;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .nd-toggle-btn.active {
    background: #9b59b6;
    color: #fff;
  }

  /* Warning */
  .nd-warn {
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: 6px;
    padding: 12px;
    font-size: 13px;
    color: #e74c3c;
    line-height: 1.5;
  }
  .nd-btn-warn {
    background: #e74c3c;
    color: #fff;
  }
  .nd-btn-warn:hover { background: #c0392b; }

  .nd-root-hint {
    font-size: 13px;
    color: #888;
    margin-bottom: 12px;
    word-break: break-all;
  }
  .nd-root-hint strong {
    color: #e0e0e0;
  }

  /* Form fields */
  .nd-field {
    margin-bottom: 12px;
  }
  .nd-field label {
    display: block;
    font-size: 11px;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .nd-field input, .nd-field textarea {
    width: 100%;
    padding: 8px 12px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 14px;
    font-family: inherit;
    box-sizing: border-box;
  }
  .nd-field input:focus, .nd-field textarea:focus {
    outline: none;
    border-color: #9b59b6;
  }
  .nd-field textarea {
    resize: vertical;
    min-height: 60px;
  }
  .nd-hint {
    font-size: 11px;
    color: #888;
    margin-top: 3px;
  }
  .nd-field-error {
    font-size: 11px;
    color: #e74c3c;
    margin-top: 3px;
  }

  /* Actions */
  .nd-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .nd-btn {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .nd-btn-primary {
    background: #9b59b6;
    color: #fff;
  }
  .nd-btn-primary:hover { background: #8e44ad; }
  .nd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .nd-btn-secondary {
    background: #16213e;
    color: #e0e0e0;
    border: 1px solid #0f3460;
  }
  .nd-btn-secondary:hover { background: #0f3460; }

  /* Status */
  .nd-status {
    margin-top: 12px;
    font-size: 13px;
    color: #888;
  }
  .nd-status-ok { color: #2ecc71; }
  .nd-status-err { color: #e74c3c; }

  .nd-link {
    display: block;
    margin-top: 12px;
    padding: 10px;
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 6px;
    color: #9b59b6;
    text-decoration: none;
    text-align: center;
    font-size: 13px;
    word-break: break-all;
  }
  .nd-link:hover { background: #0f3460; }

  .nd-msg {
    text-align: center;
    padding: 20px 0;
    font-size: 14px;
    color: #888;
  }

  /* Paper trail */
  .nd-trail {
    margin-top: 8px;
    text-align: center;
  }
  .nd-trail-toggle {
    background: none;
    border: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 8px;
    transition: color 0.2s;
  }
  .nd-trail-toggle:hover { color: #e0e0e0; }
  .nd-trail-list {
    margin-top: 6px;
    text-align: left;
    font-size: 12px;
    color: #888;
    max-height: 200px;
    overflow-y: auto;
  }
  .nd-trail-item {
    padding: 3px 0;
    font-family: monospace;
    font-size: 11px;
    display: flex;
    gap: 6px;
  }
  .nd-trail-idx {
    color: #555;
    min-width: 24px;
    text-align: right;
  }
  .nd-trail-pk {
    color: #9b59b6;
  }
  .nd-trail-gap {
    padding: 3px 0;
    color: #555;
    font-style: italic;
  }

  @keyframes nd-spin {
    to { transform: rotate(360deg); }
  }
  .nd-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid #555;
    border-top-color: #9b59b6;
    border-radius: 50%;
    animation: nd-spin 0.8s linear infinite;
    vertical-align: middle;
    margin-right: 8px;
  }
`;
