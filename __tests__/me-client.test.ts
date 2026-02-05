import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { fetchMeProfile, updateActiveSubjects, patchMeProfile } from '@/lib/me-client';

declare const global: typeof globalThis;

beforeEach(() => {
  global.fetch = jest.fn();
});

describe('me client', () => {
  it('fetches profile data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user1', activeSubjects: [], onboardingComplete: false }),
    });

    const profile = await fetchMeProfile();
    expect(profile.id).toBe('user1');
  });

  it('throws on profile fetch error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(fetchMeProfile()).rejects.toThrow('Unauthorized');
  });

  it('uses a fallback message when profile error payload is unreadable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(fetchMeProfile()).rejects.toThrow('Failed to load profile');
  });

  it('updates active subjects', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user1', activeSubjects: ['Biology'], onboardingComplete: true }),
    });

    const profile = await updateActiveSubjects(['Biology']);
    expect(profile.activeSubjects).toEqual(['Biology']);
  });

  it('throws when updating subjects fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad request' }),
    });

    await expect(updateActiveSubjects(['Biology'])).rejects.toThrow('Bad request');
  });

  it('uses a fallback message when subject update error payload is unreadable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(updateActiveSubjects(['Biology'])).rejects.toThrow('Failed to update subjects');
  });

  it('patches profile data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user1', activeSubjects: [], onboardingComplete: true }),
    });

    const profile = await patchMeProfile({ onboardingComplete: true });
    expect(profile.onboardingComplete).toBe(true);
  });

  it('throws when patching profile fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed' }),
    });

    await expect(patchMeProfile({ onboardingComplete: true })).rejects.toThrow('Failed');
  });

  it('uses a fallback message when patch error payload is unreadable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(patchMeProfile({ onboardingComplete: true })).rejects.toThrow(
      'Failed to update profile'
    );
  });
});
