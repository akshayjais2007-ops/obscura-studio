import { describe, it, expect } from 'vitest';
import { TESTS } from './selftest';

describe('Obscura core logic', () => {
  for (const t of TESTS) {
    it(`[${t.area}] ${t.name}`, () => {
      expect(() => t.fn()).not.toThrow();
    });
  }
});
