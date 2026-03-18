import { describe, it, expect } from 'vitest';

describe('SPA test setup', () => {
  it('vitest runs in apps/spa', () => {
    expect(1 + 1).toBe(2);
  });
});
