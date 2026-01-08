'use client';

import { useState, useEffect } from 'react';

interface StreakDisplayProps {
  currentStreak: number;
  freezeDays: number;
  maxFreezes: number;
  onUseFreeze?: () => Promise<void>;
  showFreezeButton?: boolean;
  showPrizeTiers?: boolean;
  compact?: boolean;
}

// Prize tiers data
const PRIZE_TIERS = [
  { days: 10, prize: '+1 Freeze Day', icon: '🛡️', color: 'from-cyan-400 to-blue-500' },
  { days: 30, prize: '£20 Brandy Melville Voucher', icon: '🛍️', color: 'from-pink-400 to-rose-500' },
  { days: 60, prize: '£50 Brandy Melville Voucher', icon: '💝', color: 'from-purple-400 to-pink-500' },
  { days: 90, prize: '£100 Brandy Melville Voucher', icon: '👑', color: 'from-amber-400 to-orange-500' },
];

// Get streak tier based on count
function getStreakTier(streak: number) {
  if (streak >= 30) return { name: 'LEGENDARY', color: 'from-purple-500 via-pink-500 to-red-500', glow: '#a855f7', ring: '#a855f7' };
  if (streak >= 14) return { name: 'DIAMOND', color: 'from-cyan-400 via-blue-500 to-purple-500', glow: '#06b6d4', ring: '#06b6d4' };
  if (streak >= 7) return { name: 'GOLD', color: 'from-yellow-400 via-orange-500 to-red-500', glow: '#f59e0b', ring: '#f59e0b' };
  if (streak >= 3) return { name: 'SILVER', color: 'from-slate-300 via-slate-400 to-slate-500', glow: '#94a3b8', ring: '#94a3b8' };
  return { name: 'BRONZE', color: 'from-orange-300 via-orange-400 to-orange-500', glow: '#fb923c', ring: '#fb923c' };
}

// Calculate progress to next tier
function getProgressToNextTier(streak: number) {
  if (streak >= 30) return { progress: 100, next: 30, current: 30 };
  if (streak >= 14) return { progress: ((streak - 14) / 16) * 100, next: 30, current: 14 };
  if (streak >= 7) return { progress: ((streak - 7) / 7) * 100, next: 14, current: 7 };
  if (streak >= 3) return { progress: ((streak - 3) / 4) * 100, next: 7, current: 3 };
  return { progress: (streak / 3) * 100, next: 3, current: 0 };
}

// Prize Tiers Modal Component
export function PrizeTiersModal({
  isOpen,
  onClose,
  currentStreak,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-3xl bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-2xl border border-white/20 shadow-2xl cursor-pointer"
        onClick={onClose}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 mb-4">
            <span className="text-3xl">🏆</span>
          </div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-pink-400 bg-clip-text text-transparent">
            Prize Tiers
          </h2>
          <p className="text-white/50 text-sm mt-1">Keep your streak going to unlock rewards!</p>
        </div>

        {/* Prize List */}
        <div className="space-y-3">
          {PRIZE_TIERS.map((tier) => {
            const isUnlocked = currentStreak >= tier.days;
            const progress = Math.min((currentStreak / tier.days) * 100, 100);

            return (
              <div
                key={tier.days}
                className={`relative p-4 rounded-2xl border transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/40'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isUnlocked
                        ? `bg-gradient-to-br ${tier.color} shadow-lg`
                        : 'bg-white/10'
                    }`}
                  >
                    <span className={`text-2xl ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                      {tier.icon}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold ${isUnlocked ? 'text-green-400' : 'text-white/80'}`}>
                        {tier.days} Day Streak
                      </span>
                      {isUnlocked && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/30 text-green-400 font-bold">
                          ✓ UNLOCKED
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isUnlocked ? 'text-green-300/80' : 'text-white/50'}`}>
                      {tier.prize}
                    </p>

                    {/* Progress bar (only for locked tiers) */}
                    {!isUnlocked && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-1">
                          {currentStreak}/{tier.days} days ({Math.round(progress)}%)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-white/30 mb-4">
            Complete quizzes daily to maintain your streak!
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95"
          >
            Got it!
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function StreakDisplay({
  currentStreak,
  freezeDays,
  maxFreezes,
  onUseFreeze,
  showFreezeButton = true,
  showPrizeTiers = true,
  compact = false,
}: StreakDisplayProps) {
  const [isUsingFreeze, setIsUsingFreeze] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);

  const handleUseFreeze = async () => {
    if (onUseFreeze && freezeDays > 0) {
      setIsUsingFreeze(true);
      try {
        await onUseFreeze();
      } finally {
        setIsUsingFreeze(false);
      }
    }
  };

  const tier = getStreakTier(currentStreak);
  const { progress, next } = getProgressToNextTier(currentStreak);
  const isOnFire = currentStreak >= 5;

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-2">
          {/* Compact flame with gradient background */}
          <div
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${tier.color} shadow-lg`}
            style={{ boxShadow: `0 0 20px ${tier.glow}40` }}
          >
            <span className={`text-lg ${isOnFire ? 'animate-pulse' : ''}`}>🔥</span>
            <span className="font-bold text-white text-sm tabular-nums">{currentStreak}</span>
          </div>

          {/* Prize tiers link */}
          {showPrizeTiers && (
            <button
              onClick={() => setShowPrizeModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <span>🏆</span>
              <span>Prizes</span>
            </button>
          )}

          {/* Compact freeze indicators */}
          {showFreezeButton && freezeDays > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: freezeDays }).map((_, i) => (
                <button
                  key={i}
                  onClick={handleUseFreeze}
                  disabled={isUsingFreeze}
                  className="text-base hover:scale-110 active:scale-95 transition-transform"
                >
                  ❄️
                </button>
              ))}
            </div>
          )}
        </div>

        <PrizeTiersModal
          isOpen={showPrizeModal}
          onClose={() => setShowPrizeModal(false)}
          currentStreak={currentStreak}
        />
      </>
    );
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Main streak card */}
        <div
          className="relative flex items-center gap-4 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden"
          style={{ boxShadow: `0 8px 32px ${tier.glow}30, inset 0 1px 0 rgba(255,255,255,0.1)` }}
        >
          {/* Animated background gradient */}
          <div
            className={`absolute inset-0 bg-gradient-to-r ${tier.color} opacity-20 animate-pulse`}
            style={{ animationDuration: '3s' }}
          />

          {/* Streak ring and flame */}
          <div className="relative z-10">
            {/* Progress ring */}
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              {/* Background ring */}
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="4"
              />
              {/* Progress ring */}
              <circle
                cx="28"
                cy="28"
                r="24"
                fill="none"
                stroke={tier.ring}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 1.508} 150.8`}
                className="transition-all duration-500"
                style={{ filter: `drop-shadow(0 0 6px ${tier.glow})` }}
              />
            </svg>

            {/* Flame in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className={`text-2xl ${isOnFire ? 'animate-bounce' : ''}`}
                style={{
                  animationDuration: '0.6s',
                  filter: isOnFire ? `drop-shadow(0 0 8px ${tier.glow})` : undefined
                }}
              >
                {currentStreak === 0 ? '💨' : '🔥'}
              </span>
            </div>
          </div>

          {/* Streak info */}
          <div className="relative z-10 flex flex-col">
            <div className="flex items-baseline gap-1">
              <span
                className={`text-3xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent tabular-nums`}
                style={{ textShadow: `0 0 30px ${tier.glow}` }}
              >
                {currentStreak}
              </span>
              <span className="text-sm text-white/60 font-medium">
                {currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <span
              className={`text-xs font-bold tracking-wider bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}
            >
              {tier.name}
            </span>
          </div>

          {/* Prize tiers button */}
          {showPrizeTiers && (
            <button
              onClick={() => setShowPrizeModal(true)}
              className="relative z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <span>🏆</span>
              <span>Prizes</span>
            </button>
          )}

          {/* Freeze shields */}
          {showFreezeButton && (
            <div className="relative z-10 flex items-center gap-1 ml-auto">
              {Array.from({ length: maxFreezes }).map((_, i) => (
                <button
                  key={i}
                  onClick={i < freezeDays ? handleUseFreeze : undefined}
                  disabled={i >= freezeDays || isUsingFreeze}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    i < freezeDays
                      ? 'bg-gradient-to-br from-cyan-400/30 to-blue-500/30 border border-cyan-400/50 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/30 active:scale-95 cursor-pointer'
                      : 'bg-white/5 border border-white/10 opacity-40 cursor-not-allowed'
                  }`}
                  title={i < freezeDays ? 'Use freeze to protect streak' : 'Earn more freezes!'}
                >
                  {isUsingFreeze && i === freezeDays - 1 ? (
                    <span className="animate-spin text-lg">❄️</span>
                  ) : (
                    <span className={`text-lg ${i < freezeDays ? '' : 'grayscale'}`}>
                      {i < freezeDays ? '🛡️' : '🔒'}
                    </span>
                  )}
                  {i < freezeDays && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-cyan-400/20 to-transparent animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tooltip */}
        {showTooltip && currentStreak > 0 && (
          <div className="absolute top-full left-0 mt-2 p-3 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-xl z-50 min-w-[200px]">
            <div className="text-xs text-white/60 mb-1">Progress to {next} days</div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${tier.color} transition-all duration-500`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-white/40">
              🛡️ Freezes protect your streak when you miss a day
            </div>
          </div>
        )}
      </div>

      <PrizeTiersModal
        isOpen={showPrizeModal}
        onClose={() => setShowPrizeModal(false)}
        currentStreak={currentStreak}
      />
    </>
  );
}

// Epic celebration animation
export function StreakCelebration({
  streak,
  freezeEarned,
  onClose,
}: {
  streak: number;
  freezeEarned: boolean;
  onClose?: () => void;
}) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);
  const tier = getStreakTier(streak);

  useEffect(() => {
    // Generate random particles
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
      }))
    );

    // Auto-close after 3 seconds
    const timer = setTimeout(() => onClose?.(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Particle effects */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute text-2xl animate-ping"
          style={{
            left: `${p.x}%`,
            top: '50%',
            animationDelay: `${p.delay}s`,
            animationDuration: '1s',
          }}
        >
          ✨
        </div>
      ))}

      {/* Main celebration card */}
      <div
        className="relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/20 shadow-2xl animate-bounce"
        style={{
          animationDuration: '0.5s',
          boxShadow: `0 0 100px ${tier.glow}60`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow background */}
        <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r ${tier.color} opacity-30 blur-xl`} />

        <div className="relative z-10 flex flex-col items-center gap-4">
          {/* Flame icon */}
          <div
            className="text-7xl animate-pulse"
            style={{
              filter: `drop-shadow(0 0 30px ${tier.glow})`,
              animationDuration: '0.5s'
            }}
          >
            🔥
          </div>

          {/* Streak count */}
          <div className="text-center">
            <div
              className={`text-5xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}
            >
              {streak} DAY{streak !== 1 ? 'S' : ''}!
            </div>
            <div className={`text-lg font-bold tracking-widest bg-gradient-to-r ${tier.color} bg-clip-text text-transparent mt-1`}>
              {tier.name} STREAK
            </div>
          </div>

          {/* Freeze earned */}
          {freezeEarned && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 animate-pulse">
              <span className="text-xl">🛡️</span>
              <span className="text-cyan-400 font-bold">+1 FREEZE EARNED!</span>
            </div>
          )}

          {/* Tap to close hint */}
          <div className="text-white/40 text-sm mt-2">tap to close</div>
        </div>
      </div>
    </div>
  );
}

// Modern streak badge for inline use
export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;

  const tier = getStreakTier(streak);
  const isOnFire = streak >= 5;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${tier.color} shadow-lg transition-transform hover:scale-105`}
      style={{ boxShadow: `0 4px 15px ${tier.glow}40` }}
    >
      <span className={isOnFire ? 'animate-pulse' : ''}>🔥</span>
      <span className="font-bold text-white text-sm tabular-nums">{streak}</span>
    </div>
  );
}
