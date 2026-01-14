import { describe, expect, it, jest } from '@jest/globals';

function createMockLeoFilter(options: { wordDictionary?: Record<string, string[]> }) {
  const words: string[] = [];
  const clearList = jest.fn(() => {
    words.splice(0, words.length);
  });
  const add = jest.fn((data: string[] | string) => {
    if (Array.isArray(data)) {
      words.push(...data);
    } else {
      words.push(data);
    }
  });
  const loadDictionary = jest.fn(() => {
    words.push('loaded');
  });
  const check = jest.fn((text: string) => words.includes(text));

  return {
    filter: {
      wordDictionary: options.wordDictionary,
      clearList,
      add,
      loadDictionary,
      check,
    },
    helpers: {
      clearList,
      add,
      loadDictionary,
      check,
      words,
    },
  };
}

describe('profanity filter configuration', () => {
  it('merges supported dictionaries when available', async () => {
    const mock = createMockLeoFilter({
      wordDictionary: {
        en: ['alpha'],
        fr: ['beta'],
        ru: ['gamma'],
      },
    });

    jest.resetModules();
    jest.unstable_mockModule('leo-profanity', () => ({
      default: mock.filter,
    }));
    jest.unstable_mockModule('naughty-words', () => ({
      default: {
        pt: ['Puta'],
        es: ['Hijoputa'],
        de: ['Arsch'],
        hi: ['Chod'],
      },
    }));

    const module = await import('@/lib/profanity-filter');
    const filter = module.createProfanityFilter();

    expect(filter.isProfane('alpha')).toBe(true);
    expect(filter.isProfane('beta')).toBe(true);
    expect(filter.isProfane('gamma')).toBe(true);
    expect(filter.isProfane('puta')).toBe(true);
    expect(filter.isProfane('hijoputa')).toBe(true);
    expect(filter.isProfane('arsch')).toBe(true);
    expect(filter.isProfane('chod')).toBe(true);
    expect(mock.helpers.loadDictionary).not.toHaveBeenCalled();
    expect(mock.helpers.clearList).toHaveBeenCalledTimes(1);
  });

  it('falls back to loadDictionary when dictionaries are missing', async () => {
    const mock = createMockLeoFilter({ wordDictionary: undefined });

    jest.resetModules();
    jest.unstable_mockModule('leo-profanity', () => ({
      default: mock.filter,
    }));
    jest.unstable_mockModule('naughty-words', () => ({
      default: {},
    }));

    const module = await import('@/lib/profanity-filter');
    const filter = module.createProfanityFilter();

    expect(filter.isProfane('loaded')).toBe(true);
    expect(mock.helpers.loadDictionary).toHaveBeenCalledWith('en');
  });
});
