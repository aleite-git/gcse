'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@/lib/use-me';
import { hasSupportedSubjects, shouldRedirectToOnboarding } from '@/lib/onboarding';

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, status, error, refresh } = useMe();

  useEffect(() => {
    if (status === 'unauthorized') {
      router.replace('/');
      return;
    }

    if (profile && shouldRedirectToOnboarding(profile, pathname)) {
      router.replace('/onboarding/subjects');
      return;
    }

    if (profile && !hasSupportedSubjects(profile) && pathname !== '/onboarding/subjects') {
      router.replace('/onboarding/subjects');
    }
  }, [profile, pathname, router, status]);

  if (loading || status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white">Unable to load your profile</h2>
          <p className="mt-3 text-white/60">{error || 'Please try again in a moment.'}</p>
          <button
            onClick={() => refresh()}
            className="mt-6 rounded-full bg-purple-500 px-6 py-3 text-white font-semibold hover:bg-purple-400"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
