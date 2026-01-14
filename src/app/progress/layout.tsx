'use client';

import OnboardingGate from '@/components/OnboardingGate';

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingGate>{children}</OnboardingGate>;
}
