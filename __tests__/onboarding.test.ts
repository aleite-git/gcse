import { describe, it, expect } from '@jest/globals';
import {
  mapActiveSubjectsToAppSubjects,
  isOnboardingComplete,
  shouldRedirectToOnboarding,
  hasSupportedSubjects,
  getActiveSubjectsForApp,
  validateSubjectSelection,
} from '@/lib/onboarding';
import type { MeProfile } from '@/lib/me-client';
import type { ActiveSubject } from '@/lib/active-subjects';

const profile = (overrides: Partial<MeProfile>): MeProfile => ({
  id: 'user-1',
  activeSubjects: [],
  onboardingComplete: false,
  ...overrides,
});

describe('onboarding helpers', () => {
  it('maps active subjects to app subjects and removes duplicates', () => {
    const input: ActiveSubject[] = ['Biology', 'Chemistry', 'Biology', 'Computer Science'];
    const mapped = mapActiveSubjectsToAppSubjects(input);
    expect(mapped).toEqual(['biology', 'chemistry', 'computer-science']);
  });

  it('returns onboarding complete only when flag and subjects are set', () => {
    expect(isOnboardingComplete(profile({ onboardingComplete: false, activeSubjects: ['Biology'] })) ).toBe(false);
    expect(isOnboardingComplete(profile({ onboardingComplete: true, activeSubjects: [] })) ).toBe(false);
    expect(isOnboardingComplete(profile({ onboardingComplete: true, activeSubjects: ['Biology'] })) ).toBe(true);
    expect(isOnboardingComplete(null)).toBe(false);
  });

  it('redirects to onboarding when incomplete and not already on onboarding path', () => {
    const prof = profile({ onboardingComplete: false, activeSubjects: [] });
    expect(shouldRedirectToOnboarding(prof, '/quiz/today')).toBe(true);
    expect(shouldRedirectToOnboarding(prof, '/onboarding/subjects')).toBe(false);
    expect(shouldRedirectToOnboarding(null, '/quiz/today')).toBe(false);
  });

  it('detects supported subjects and returns them for app', () => {
    const prof = profile({ activeSubjects: ['Biology'] });
    expect(hasSupportedSubjects(prof)).toBe(true);
    expect(getActiveSubjectsForApp(prof)).toEqual(['biology']);
    expect(hasSupportedSubjects(null)).toBe(false);
    expect(getActiveSubjectsForApp(null)).toEqual([]);
  });

  it('validates subject selection rules', () => {
    expect(validateSubjectSelection([])).toEqual({ valid: false, message: 'Select at least one subject to continue.' });
    expect(validateSubjectSelection(['Biology'], { requireSupported: true })).toEqual({ valid: true });
    expect(validateSubjectSelection(['Computer Science'], { requireSupported: true })).toEqual({ valid: true });
    expect(
      validateSubjectSelection(['Physics' as ActiveSubject], { requireSupported: true })
    ).toEqual({ valid: false, message: 'Select at least one available subject to continue.' });
  });
});
