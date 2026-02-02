import type { ActiveSubject } from '@/lib/active-subjects';

export type MeProfile = {
  id: string;
  activeSubjects: ActiveSubject[];
  onboardingComplete: boolean;
  entitlement?: 'premium' | 'free';
  subscriptionStatus?: 'active' | 'grace' | 'expired';
  subscriptionStart?: string | null;
  subscriptionExpiry?: string | null;
  graceUntil?: string | null;
  subscriptionProvider?: string | null;
  adminOverride?: boolean;
};

type ApiError = { error: string };

export async function fetchMeProfile(): Promise<MeProfile> {
  const response = await fetch('/api/v1/me', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    const message = payload.error || 'Failed to load profile';
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json();
}

export async function updateActiveSubjects(
  activeSubjects: ActiveSubject[]
): Promise<MeProfile> {
  const response = await fetch('/api/v1/me/subjects', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ activeSubjects }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    const message = payload.error || 'Failed to update subjects';
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json();
}

export async function patchMeProfile(
  body: Partial<Pick<MeProfile, 'activeSubjects' | 'onboardingComplete'>>
): Promise<MeProfile> {
  const response = await fetch('/api/v1/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    const message = payload.error || 'Failed to update profile';
    const error = new Error(message);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return response.json();
}
