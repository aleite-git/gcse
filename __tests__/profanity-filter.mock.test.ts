import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const exists = jest.fn((text: string) => text === 'bad');

jest.unstable_mockModule('@2toad/profanity', () => ({
  Profanity: class {
    exists(value: string) {
      return exists(value);
    }
  },
}));

describe('profanity filter normalization', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('normalizes symbol substitutions before checking profanity', async () => {
    const { createProfanityFilter } = await import('@/lib/profanity-filter');
    const filter = createProfanityFilter();

    expect(filter.isProfane('b@d')).toBe(true);
    expect(exists).toHaveBeenCalledWith('bad');
  });

  it('creates a fresh filter after module reset', async () => {
    const mod1 = await import('@/lib/profanity-filter');
    const filter1 = mod1.createProfanityFilter();

    jest.resetModules();

    const mod2 = await import('@/lib/profanity-filter');
    const filter2 = mod2.createProfanityFilter();

    // After resetModules, a new module instance is created with its own cache,
    // so the two filters come from different module instances.
    expect(filter1).not.toBe(filter2);
    expect(filter2.isProfane('bad')).toBe(true);
  });
});
