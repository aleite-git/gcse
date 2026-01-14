import { describe, expect, it } from '@jest/globals';
import { createProfanityFilter } from '@/lib/profanity-filter';

describe('profanity filter', () => {
  it('returns the same cached filter instance', () => {
    const first = createProfanityFilter();
    const second = createProfanityFilter();

    expect(first).toBe(second);
  });

  it('detects profane usernames with digits and underscores', () => {
    const filter = createProfanityFilter();

    expect(filter.isProfane('shit_098')).toBe(true);
    expect(filter.isProfane('sh1t123')).toBe(true);
    expect(filter.isProfane('ExistingUser')).toBe(false);
    expect(filter.isProfane('hello_123')).toBe(false);
  });
});
