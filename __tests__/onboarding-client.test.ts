import { describe, expect, it } from '@jest/globals';
import type { ActiveSubject } from '@/lib/active-subjects';
import { getActiveSubjectsForApp, mapActiveSubjectsToAppSubjects, shouldRedirectToOnboarding, validateSubjectSelection } from '@/lib/onboarding';

describe('onboarding client helpers', () => {
  it('redirects to onboarding when onboarding is incomplete', () => {
    const profile = {
      id: 'user-1',
      activeSubjects: [],
      onboardingComplete: false,
    };

    expect(shouldRedirectToOnboarding(profile, '/quiz/subjects')).toBe(true);
  });

  it('validates empty subject selection', () => {
    const result = validateSubjectSelection([]);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Select at least one subject/i);
  });

  it('validates supported subject selection when required', () => {
    const selected = ['Physics' as ActiveSubject];
    const result = validateSubjectSelection(selected, { requireSupported: true });

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Select at least one available subject/i);
  });

  it('maps active subjects to app subjects without duplicates', () => {
    const selected = ['Biology', 'Chemistry', 'Biology', 'Computer Science'] as ActiveSubject[];
    const mapped = mapActiveSubjectsToAppSubjects(selected);

    expect(mapped).toEqual(['biology', 'chemistry', 'computer-science']);
  });

  it('returns active subjects for app from profile', () => {
    const profile = {
      id: 'user-2',
      activeSubjects: ['Chemistry', 'Computer Science'] as ActiveSubject[],
      onboardingComplete: true,
    };

    expect(getActiveSubjectsForApp(profile)).toEqual(['chemistry', 'computer-science']);
  });
});
