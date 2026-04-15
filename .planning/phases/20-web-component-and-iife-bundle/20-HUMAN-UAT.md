---
status: partial
phase: 20-web-component-and-iife-bundle
source: [20-VERIFICATION.md]
started: 2026-03-25T23:15:00Z
updated: 2026-03-25T23:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Trigger buttons render correctly
expected: Open packages/deployer/test/test-widget.html in browser (after running `npm run build:widget` in packages/deployer). Four trigger buttons should render: "Deploy to nsite" (default purple), "Publish site" (purple), "Go Green" (green #059669), and "Programmatic Test" (purple).
result: [pending]

### 2. Click trigger opens full modal
expected: Clicking any trigger button opens a full-screen modal overlay with backdrop blur. The modal should contain the DeployerWidget UI with login/deploy functionality.
result: [pending]

### 3. Modal close mechanisms work
expected: Modal closes via: (a) pressing Escape key, (b) clicking the dark backdrop area outside the modal, (c) clicking the X close button in the top-right. After closing, the trigger button becomes clickable again.
result: [pending]

### 4. Custom trigger-label shows correct text
expected: The second deployer instance shows "Publish site" as its button text instead of the default "Deploy to nsite".
result: [pending]

### 5. Custom styling applies
expected: The third deployer instance ("Go Green") shows a green background button instead of the default purple.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
