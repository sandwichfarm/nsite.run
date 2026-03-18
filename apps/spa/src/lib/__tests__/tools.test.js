import { describe, it, expect } from 'vitest';
import toolsData from '../tools-resources.yaml';

describe('tools-resources.yaml', () => {
  it('loads without error and is an object', () => {
    expect(toolsData).toBeDefined();
    expect(typeof toolsData).toBe('object');
  });

  it('has a categories array with at least 3 categories', () => {
    expect(Array.isArray(toolsData.categories)).toBe(true);
    expect(toolsData.categories.length).toBeGreaterThanOrEqual(3);
  });

  it('every category has a name string and items array', () => {
    for (const cat of toolsData.categories) {
      expect(typeof cat.name).toBe('string');
      expect(cat.name.length).toBeGreaterThan(0);
      expect(Array.isArray(cat.items)).toBe(true);
      expect(cat.items.length).toBeGreaterThan(0);
    }
  });

  it('every item has name, url, and description strings', () => {
    for (const cat of toolsData.categories) {
      for (const item of cat.items) {
        expect(typeof item.name).toBe('string');
        expect(typeof item.url).toBe('string');
        expect(item.url).toMatch(/^https?:\/\//);
        expect(typeof item.description).toBe('string');
      }
    }
  });

  it('includes nsite.run gateway entry', () => {
    const allItems = toolsData.categories.flatMap((c) => c.items);
    const nsiteEntry = allItems.find((i) => i.url.includes('nsite.run'));
    expect(nsiteEntry).toBeDefined();
  });
});
