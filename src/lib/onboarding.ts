import type { MeProfile } from './me-client';
import type { Subject } from '@/types';
import type { ActiveSubject } from '@/lib/active-subjects';

const ACTIVE_SUBJECT_TO_APP: Partial<Record<ActiveSubject, Subject>> = {
  Biology: 'biology',
  Chemistry: 'chemistry',
  'Computer Science': 'computer-science',
};

export function mapActiveSubjectsToAppSubjects(activeSubjects: ActiveSubject[]): Subject[] {
  const mapped: Subject[] = [];

  for (const subject of activeSubjects) {
    const appSubject = ACTIVE_SUBJECT_TO_APP[subject];
    if (appSubject && !mapped.includes(appSubject)) {
      mapped.push(appSubject);
    }
  }

  return mapped;
}

export function isOnboardingComplete(profile: MeProfile | null): boolean {
  if (!profile) return false;
  return profile.onboardingComplete && profile.activeSubjects.length > 0;
}

export function shouldRedirectToOnboarding(
  profile: MeProfile | null,
  pathname: string
): boolean {
  if (!profile) return false;
  const onboardingPath = '/onboarding/subjects';
  if (pathname.startsWith(onboardingPath)) {
    return false;
  }
  return !isOnboardingComplete(profile);
}

export function hasSupportedSubjects(profile: MeProfile | null): boolean {
  if (!profile) return false;
  return mapActiveSubjectsToAppSubjects(profile.activeSubjects).length > 0;
}

export function getActiveSubjectsForApp(profile: MeProfile | null): Subject[] {
  if (!profile) return [];
  return mapActiveSubjectsToAppSubjects(profile.activeSubjects);
}

export function validateSubjectSelection(
  selected: ActiveSubject[],
  options?: { requireSupported?: boolean }
): { valid: boolean; message?: string } {
  if (selected.length === 0) {
    return { valid: false, message: 'Select at least one subject to continue.' };
  }

  if (options?.requireSupported) {
    const supportedCount = mapActiveSubjectsToAppSubjects(selected).length;
    if (supportedCount === 0) {
      return { valid: false, message: 'Select at least one available subject to continue.' };
    }
  }

  return { valid: true };
}
