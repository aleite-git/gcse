'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid access code');
        return;
      }

      router.push(data.redirectTo || '/quiz/today');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transition-all duration-1000 ${
            mounted ? 'animate-pulse' : ''
          }`}
          style={{ animationDuration: '4s' }}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transition-all duration-1000 ${
            mounted ? 'animate-pulse' : ''
          }`}
          style={{ animationDuration: '5s', animationDelay: '1s' }}
        />
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 transition-all duration-1000 ${
            mounted ? 'animate-pulse' : ''
          }`}
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Icon */}
        <div className={`text-center mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-2xl shadow-purple-500/30 mb-6">
            <span className="text-4xl">🧠</span>
          </div>
        </div>

        {/* Main card */}
        <div
          className={`bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 p-8 shadow-2xl transition-all duration-700 delay-100 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }}
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent mb-3">
              Daily 5 GCSE CS
            </h1>
            <p className="text-white/50 text-sm">
              5 questions a day keeps the exam fears away
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-white/60 mb-2"
              >
                Enter access code
              </label>
              <div className="relative">
                <input
                  id="code"
                  type="password"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-white placeholder-white/30 outline-none"
                  placeholder="Enter your code"
                  autoComplete="off"
                  required
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code}
              className="relative w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 focus:ring-4 focus:ring-purple-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-pink-600 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] overflow-hidden group"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <span className="relative z-10">Continue</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-xs text-white/30">
              Computer Systems & Theory
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className={`mt-6 text-center text-sm text-white/30 transition-all duration-700 delay-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          Made with <span className="text-red-400">❤️</span> for Pimpolho
        </p>

        {/* Feature hints */}
        <div className={`mt-8 flex justify-center gap-6 transition-all duration-700 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <span className="text-lg">🔥</span>
            <span>Daily Streaks</span>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <span className="text-lg">📊</span>
            <span>Track Progress</span>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <span className="text-lg">🎯</span>
            <span>GCSE Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
