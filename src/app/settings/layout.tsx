'use client';

import OnboardingGate from '@/components/OnboardingGate';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingGate>{children}</OnboardingGate>;
}
