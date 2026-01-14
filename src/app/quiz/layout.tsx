'use client';

import OnboardingGate from '@/components/OnboardingGate';

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingGate>{children}</OnboardingGate>;
}
