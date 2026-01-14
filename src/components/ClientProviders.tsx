'use client';

import { MeProvider } from '@/lib/use-me';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <MeProvider>{children}</MeProvider>;
}
