import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    USER_STREAKS: 'userStreaks',
    STREAK_ACTIVITIES: 'streakActivities',
  },
}));

const { recordActivity, OVERALL_STREAK_SUBJECT } = await import('@/lib/streak');

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
        timezone: 'Europe/Lisbon',
        streakStartDate: '2026-01-10',
        lastFreezeEarnedAt: 0,
        updatedAt: { toDate: () => new Date('2026-01-12T12:00:00Z') },
      },
    });

    getDb.mockReturnValue({ collection });

    const result = await recordActivity('user', 'biology', 'quiz_submit', 'Europe/Lisbon');

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
        timezone: 'Europe/Lisbon',
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
        timezone: 'Europe/Lisbon',
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
      'Europe/Lisbon'
    );

    expect(result.freezeEarned).toBe(false);
    expect(result.streak.currentStreak).toBe(4);
    expect(result.streak.freezeDays).toBe(0);
    expect(result.streak.lastActivityDate).toBe('2026-01-14');
    expect(userStreaks.get('user-overall')?.freezeDays).toBe(0);
  });
});
