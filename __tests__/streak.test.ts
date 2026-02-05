import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    USER_STREAKS: 'userStreaks',
    STREAK_ACTIVITIES: 'streakActivities',
  },
}));

const {
  recordActivity,
  OVERALL_STREAK_SUBJECT,
  checkAndApplyFreeze,
  useFreeze,
  getStreakStatus,
  updateTimezone,
  getOrCreateUserStreak,
} = await import('@/lib/streak');

type StreakDoc = Record<string, unknown>;

function createFirestoreMock(seed: Record<string, StreakDoc> = {}) {
  const userStreaks = new Map(Object.entries(seed));
  const activities: Array<Record<string, unknown>> = [];

  const collection = (name: string) => {
    if (name === 'userStreaks') {
      const where = (field: string, _op: string, value: unknown) => ({
        get: async () => {
          const matches = Array.from(userStreaks.entries())
            .filter(([, data]) => data?.[field] === value)
            .map(([id, data]) => ({
              id,
              data: () => data,
            }));
          return {
            forEach: (callback: (doc: { id: string; data: () => StreakDoc }) => void) => {
              matches.forEach(callback);
            },
          };
        },
      });

      return {
        where,
        doc: (id: string) => ({
          get: async () => ({
            exists: userStreaks.has(id),
            data: () => userStreaks.get(id),
          }),
          set: async (data: StreakDoc, options?: { merge?: boolean }) => {
            if (options?.merge) {
              const current = userStreaks.get(id) || {};
              userStreaks.set(id, { ...current, ...data });
              return;
            }
            userStreaks.set(id, data);
          },
          update: async (data: StreakDoc) => {
            const current = userStreaks.get(id) || {};
            userStreaks.set(id, { ...current, ...data });
          },
        }),
      };
    }

    if (name === 'streakActivities') {
      return {
        add: async (data: Record<string, unknown>) => {
          activities.push(data);
          return { id: `activity-${activities.length}` };
        },
      };
    }

    throw new Error(`Unknown collection ${name}`);
  };

  return { collection, userStreaks, activities };
}

describe('recordActivity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-14T12:00:00Z'));
    getDb.mockReset();
  });

  it('resets non-overall streak without using freezes', async () => {
    const { collection, userStreaks } = createFirestoreMock({
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 3,
        longestStreak: 3,
        lastActivityDate: '2026-01-12',
        freezeDays: 2,
        freezeDaysUsed: 1,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-10',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-12T12:00:00Z') },
      },
    });

    getDb.mockReturnValue({ collection });

    const result = await recordActivity('user', 'biology', 'quiz_submit', 'Europe/London');

    expect(result.freezeEarned).toBe(false);
    expect(result.streak.currentStreak).toBe(1);
    expect(result.streak.freezeDays).toBe(0);
    expect(result.streak.lastActivityDate).toBe('2026-01-14');
    expect(userStreaks.get('user-biology')?.freezeDays).toBe(0);
  });

  it('uses freezes for the overall streak', async () => {
    const { collection, userStreaks } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 3,
        longestStreak: 3,
        lastActivityDate: '2026-01-12',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-10',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-12T12:00:00Z') },
      },
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2026-01-13',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-09',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });

    getDb.mockReturnValue({ collection });

    const result = await recordActivity(
      'user',
      OVERALL_STREAK_SUBJECT,
      'quiz_submit',
      'Europe/London'
    );

    expect(result.freezeEarned).toBe(false);
    expect(result.streak.currentStreak).toBe(4);
    expect(result.streak.freezeDays).toBe(0);
    expect(result.streak.lastActivityDate).toBe('2026-01-14');
    expect(userStreaks.get('user-overall')?.freezeDays).toBe(0);
  });

  it('returns early when activity already exists for today', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-14',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await recordActivity('user', OVERALL_STREAK_SUBJECT, 'login', 'Europe/London');
    expect(result.isNewDay).toBe(false);
    expect(result.freezeEarned).toBe(false);
  });
});

describe('streak helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-14T12:00:00Z'));
    getDb.mockReset();
  });

  it('applies freeze days when missed days exist', async () => {
    const { collection, userStreaks } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: '2026-01-10',
        freezeDays: 2,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-06',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-10T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await checkAndApplyFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.frozeApplied).toBe(true);
    expect(userStreaks.get('user-overall')?.freezeDays).toBe(0);
  });

  it('allows manual freeze usage', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 3,
        longestStreak: 3,
        lastActivityDate: '2026-01-12',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-10',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-12T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await useFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.success).toBe(true);
    expect(result.streak.freezeDays).toBe(0);
  });

  it('returns streak status', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-14',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const status = await getStreakStatus('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(status.currentStreak).toBe(2);
    expect(status.freezeDays).toBe(1);
    expect(status.streakActive).toBe(true);
  });

  it('updates timezone on profile', async () => {
    const { collection, userStreaks } = createFirestoreMock({
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: '2026-01-14',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-14',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    await updateTimezone('user', 'biology', 'Europe/London');
    expect(userStreaks.get('user-biology')?.timezone).toBe('Europe/London');
  });

  it('checkAndApplyFreeze does nothing for non-overall subject', async () => {
    const { collection } = createFirestoreMock({
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: '2026-01-14',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-14',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await checkAndApplyFreeze('user', 'biology', 'Europe/London');
    expect(result.frozeApplied).toBe(false);
  });

  it('useFreeze rejects when no freeze days are available', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-13',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-12',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await useFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.success).toBe(false);
  });

  it('checkAndApplyFreeze returns early when no activity is recorded', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await checkAndApplyFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.frozeApplied).toBe(false);
    expect(result.missedDays).toBe(0);
  });

  it('checkAndApplyFreeze returns early when already active today', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-14',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await checkAndApplyFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.frozeApplied).toBe(false);
    expect(result.missedDays).toBe(0);
  });

  it('checkAndApplyFreeze does nothing when only yesterday is missed', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-13',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-12',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await checkAndApplyFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(result.frozeApplied).toBe(false);
    expect(result.missedDays).toBe(0);
  });

  it('recordActivity handles first activity and future-date recovery', async () => {
    const { collection, userStreaks } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-10T12:00:00Z') },
      },
      'user-ghost': {
        userLabel: 'user',
        subject: undefined,
      },
    });
    getDb.mockReturnValue({ collection });

    const first = await recordActivity('user', OVERALL_STREAK_SUBJECT, 'login', 'Europe/London');
    expect(first.streak.currentStreak).toBe(1);

    // Force a future date (tomorrow) to hit the "shouldn't happen" branch.
    userStreaks.set('user-overall', {
      ...userStreaks.get('user-overall'),
      lastActivityDate: '2026-01-15',
      currentStreak: 2,
      longestStreak: 2,
    });

    const recovered = await recordActivity('user', OVERALL_STREAK_SUBJECT, 'login', 'Europe/London');
    expect(recovered.streak.currentStreak).toBe(3);
  });

  it('recordActivity uses partial freezes when missed days exceed balance', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 3,
        longestStreak: 3,
        lastActivityDate: '2026-01-10',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-08',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-10T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await recordActivity('user', OVERALL_STREAK_SUBJECT, 'quiz_submit', 'Europe/London');
    expect(result.streak.currentStreak).toBe(1);
  });

  it('recordActivity increments streak on consecutive days', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-13',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-12',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const result = await recordActivity('user', OVERALL_STREAK_SUBJECT, 'login', 'Europe/London');
    expect(result.streak.currentStreak).toBe(3);
  });

  it('useFreeze handles non-overall subjects and activity edge cases', async () => {
    const { collection } = createFirestoreMock({
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: '2026-01-14',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-14',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-14',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const nonOverall = await useFreeze('user', 'biology', 'Europe/London');
    expect(nonOverall.success).toBe(false);

    const alreadyActive = await useFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(alreadyActive.success).toBe(false);
    expect(alreadyActive.message).toBe('Already active today, no need for freeze');
  });

  it('useFreeze rejects when there is no missed day or no streak', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-13',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-12',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const noMissed = await useFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(noMissed.message).toBe('No missed days to cover');

    const { collection: emptyCollection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        freezeDays: 1,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection: emptyCollection });

    const noStreak = await useFreeze('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(noStreak.message).toBe('No streak to protect yet');
  });

  it('returns streak status for missed days with and without freezes', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-12',
        freezeDays: 2,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-10',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-12T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const covered = await getStreakStatus('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(covered.streakActive).toBe(true);

    const { collection: collection2 } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-10',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-08',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-10T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection: collection2 });

    const lost = await getStreakStatus('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(lost.streakActive).toBe(false);
  });

  it('returns streak status for yesterday activity', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-13',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-12',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-13T12:00:00Z') },
      },
    });
    getDb.mockReturnValue({ collection });

    const status = await getStreakStatus('user', OVERALL_STREAK_SUBJECT, 'Europe/London');
    expect(status.streakActive).toBe(true);
    expect(status.daysUntilStreakLoss).toBe(0);
  });

  it('creates a streak when updating timezone without an existing doc', async () => {
    const { collection, userStreaks } = createFirestoreMock();
    getDb.mockReturnValue({ collection });

    await updateTimezone('user', 'biology', 'Europe/London');
    expect(userStreaks.has('user-biology')).toBe(true);
  });

  it('uses default timezone and Date updatedAt values', async () => {
    const { collection } = createFirestoreMock({
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: '2026-01-13',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: '',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: new Date('2026-01-13T12:00:00Z'),
      },
    });
    getDb.mockReturnValue({ collection });

    const streak = await getOrCreateUserStreak('user', 'biology');
    expect(streak.timezone).toBe('Europe/London');
    expect(streak.updatedAt).toBeInstanceOf(Date);
  });

  it('caps max freezes based on the longest subject streak', async () => {
    const { collection } = createFirestoreMock({
      'user-overall': {
        userLabel: 'user',
        subject: 'overall',
        currentStreak: 2,
        longestStreak: 2,
        lastActivityDate: '2026-01-14',
        freezeDays: 5,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-13',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
      'user-biology': {
        userLabel: 'user',
        subject: 'biology',
        currentStreak: 25,
        longestStreak: 25,
        lastActivityDate: '2026-01-14',
        freezeDays: 0,
        freezeDaysUsed: 0,
        timezone: 'Europe/London',
        streakStartDate: '2026-01-01',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-14T12:00:00Z') },
      },
      'user-ghost': {
        userLabel: 'user',
        subject: undefined,
      },
    });
    getDb.mockReturnValue({ collection });

    const status = await getStreakStatus('user', OVERALL_STREAK_SUBJECT);
    expect(status.maxFreezes).toBe(2);
  });
});
