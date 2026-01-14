import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { MeProfile } from './me-client';
import { fetchMeProfile } from './me-client';

type MeState = {
  profile: MeProfile | null;
  loading: boolean;
  error: string | null;
  status: 'idle' | 'loading' | 'ready' | 'unauthorized' | 'error';
  refresh: () => Promise<void>;
  setProfile: (profile: MeProfile | null) => void;
};

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MeState['status']>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus('loading');
    setError(null);

    try {
      const data = await fetchMeProfile();
      setProfile(data);
      setStatus('ready');
    } catch (err) {
      const error = err as Error & { status?: number };
      setProfile(null);
      if (error.status === 401) {
        setStatus('unauthorized');
      } else {
        setStatus('error');
        setError(error.message || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      status,
      refresh,
      setProfile,
    }),
    [profile, loading, error, status, refresh]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeState {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error('useMe must be used within MeProvider');
  }
  return context;
}
