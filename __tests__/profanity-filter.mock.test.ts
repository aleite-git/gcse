import { beforeAll, describe, expect, it, jest } from '@jest/globals';

const exists = jest.fn((text: string) => text === 'bad');

jest.unstable_mockModule('@2toad/profanity', () => ({
  Profanity: class {
    exists(value: string) {
      return exists(value);
    }
  },
}));

let createProfanityFilter: typeof import('@/lib/profanity-filter').createProfanityFilter;
let __resetProfanityCacheForTests: typeof import('@/lib/profanity-filter').__resetProfanityCacheForTests;

beforeAll(async () => {
  ({ createProfanityFilter, __resetProfanityCacheForTests } = await import('@/lib/profanity-filter'));
});

describe('profanity filter normalization', () => {
  it('normalizes symbol substitutions before checking profanity', () => {
    __resetProfanityCacheForTests();
    const filter = createProfanityFilter();

    expect(filter.isProfane('b@d')).toBe(true);
    expect(exists).toHaveBeenCalledWith('bad');
  });

  it('returns false if the profanity cache is cleared', () => {
    __resetProfanityCacheForTests();
    const filter = createProfanityFilter();
    __resetProfanityCacheForTests();

    expect(filter.isProfane('bad')).toBe(false);
  });
});
