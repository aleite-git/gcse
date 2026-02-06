import { getDb, COLLECTIONS } from './firebase';
import { UserStreak, StreakStatus, StreakSubject } from '@/types';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { subDays } from 'date-fns';

// Configuration
const MAX_FREEZES = 2; // Maximum freeze days a user can hold
const FREEZE_EARN_INTERVAL = 5; // Earn 1 freeze every N consecutive streak days
export const OVERALL_STREAK_SUBJECT: StreakSubject = 'overall';

function isOverallSubject(subject: StreakSubject): subject is 'overall' {
  return subject === OVERALL_STREAK_SUBJECT;
}

async function getMaxSubjectStreak(userLabel: string): Promise<number> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.USER_STREAKS)
    .where('userLabel', '==', userLabel)
    .get();

  let maxStreak = 0;
  let overallLongest = 0;

  snapshot.forEach((doc) => {
    const data = doc.data();
    const subject = data.subject;
    const longest = data.longestStreak || 0;

    if (subject === OVERALL_STREAK_SUBJECT) {
      overallLongest = longest;
      return;
    }

    if (!subject) {
      return;
    }

    if (longest > maxStreak) {
      maxStreak = longest;
    }
  });

  return maxStreak > 0 ? maxStreak : overallLongest;
}

function getEarnedFreezeCount(maxStreak: number): number {
  if (maxStreak <= 0) return 0;
  return Math.floor(maxStreak / FREEZE_EARN_INTERVAL);
}

async function syncOverallFreezeDays(
  userLabel: string,
  timezone: string,
  prefetchedOverall?: UserStreak
): Promise<{ maxStreak: number; earnedFreezes: number; updatedOverall: UserStreak }> {
  const db = getDb();
  const overall = prefetchedOverall ?? await getOrCreateUserStreak(userLabel, OVERALL_STREAK_SUBJECT, timezone);
  const maxStreak = await getMaxSubjectStreak(userLabel);
  const earnedFreezes = getEarnedFreezeCount(maxStreak);

  const freezeDaysUsed = overall.freezeDaysUsed || 0;
  const freezeDays = Math.min(MAX_FREEZES, Math.max(0, earnedFreezes - freezeDaysUsed));
  const lastFreezeEarnedAt = earnedFreezes * FREEZE_EARN_INTERVAL;

  const docId = `${userLabel}-${OVERALL_STREAK_SUBJECT}`;
  const updatedAt = new Date();
  await db.collection(COLLECTIONS.USER_STREAKS).doc(docId).set(
    {
      freezeDays,
      lastFreezeEarnedAt,
      updatedAt,
    },
    { merge: true }
  );

  // Construct updated streak locally instead of re-reading from Firestore
  const updatedOverall: UserStreak = {
    ...overall,
    freezeDays,
    lastFreezeEarnedAt,
    updatedAt,
  };

  return { maxStreak, earnedFreezes, updatedOverall };
}

/**
 * Get today's date in the user's timezone (YYYY-MM-DD)
 */
export function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
}

/**
 * Get yesterday's date in the user's timezone (YYYY-MM-DD)
 */
function getYesterdayInTimezone(timezone: string): string {
  const zonedNow = toZonedTime(new Date(), timezone);
  const zonedYesterday = subDays(zonedNow, 1);
  return formatInTimeZone(zonedYesterday, timezone, 'yyyy-MM-dd');
}

/**
 * Calculate the number of days between two dates (YYYY-MM-DD strings)
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00Z');
  const d2 = new Date(date2 + 'T00:00:00Z');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get or create user streak document for a specific subject
 */
export async function getOrCreateUserStreak(
  userLabel: string,
  subject: StreakSubject,
  timezone: string = 'Europe/London'
): Promise<UserStreak> {
  const db = getDb();
  const docId = `${userLabel}-${subject}`;
  const docRef = db.collection(COLLECTIONS.USER_STREAKS).doc(docId);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data()!;
    const updatedAtValue = data.updatedAt;
    const updatedAt =
      updatedAtValue && typeof updatedAtValue.toDate === 'function'
        ? updatedAtValue.toDate()
        : updatedAtValue instanceof Date
          ? updatedAtValue
          : new Date();

    return {
      userLabel: data.userLabel,
      subject: data.subject,
      currentStreak: data.currentStreak || 0,
      longestStreak: data.longestStreak || 0,
      lastActivityDate: data.lastActivityDate || '',
      freezeDays: data.freezeDays || 0,
      freezeDaysUsed: data.freezeDaysUsed || 0,
      timezone: data.timezone || timezone,
      streakStartDate: data.streakStartDate || '',
      lastFreezeEarnedAt: data.lastFreezeEarnedAt || 0,
      updatedAt,
    };
  }

  // Create new streak document
  const newStreak: UserStreak = {
    userLabel,
    subject,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: '',
    freezeDays: 0,
    freezeDaysUsed: 0,
    timezone,
    streakStartDate: '',
    lastFreezeEarnedAt: 0,
    updatedAt: new Date(),
  };

  await docRef.set(newStreak);
  return newStreak;
}

/**
 * Check and apply freeze days for missed days (auto-freeze logic)
 * Returns the updated streak and whether a freeze was applied
 */
export async function checkAndApplyFreeze(
  userLabel: string,
  subject: StreakSubject,
  timezone: string
): Promise<{ streak: UserStreak; frozeApplied: boolean; missedDays: number }> {
  if (!isOverallSubject(subject)) {
    const streak = await getOrCreateUserStreak(userLabel, subject, timezone);
    return { streak, frozeApplied: false, missedDays: 0 };
  }

  const streak = await getOrCreateUserStreak(userLabel, subject, timezone);
  const today = getTodayInTimezone(timezone);

  // If no previous activity, nothing to freeze
  if (!streak.lastActivityDate) {
    return { streak, frozeApplied: false, missedDays: 0 };
  }

  // If already active today, nothing to do
  if (streak.lastActivityDate === today) {
    return { streak, frozeApplied: false, missedDays: 0 };
  }

  const missedDays = daysBetween(streak.lastActivityDate, today) - 1;

  // If no missed days (yesterday was the last activity), nothing to freeze
  if (missedDays <= 0) {
    return { streak, frozeApplied: false, missedDays: 0 };
  }

  // Check if we can cover missed days with freeze days
  const freezesToUse = Math.min(missedDays, streak.freezeDays);

  if (freezesToUse > 0) {
    // Apply freeze days
    const db = getDb();
    const docId = `${userLabel}-${subject}`;
    const docRef = db.collection(COLLECTIONS.USER_STREAKS).doc(docId);

    // Update streak with freeze applied
    // The streak continues, we just mark freeze days as used
    // We also need to update lastActivityDate to cover the gap

    await docRef.update({
      freezeDays: streak.freezeDays - freezesToUse,
      freezeDaysUsed: streak.freezeDaysUsed + freezesToUse,
      // Don't update lastActivityDate - that happens on actual activity
      updatedAt: new Date(),
    });

    const updatedStreak = await getOrCreateUserStreak(userLabel, subject, timezone);
    return {
      streak: updatedStreak,
      frozeApplied: true,
      missedDays: missedDays - freezesToUse, // Remaining uncovered days
    };
  }

  // No freezes available to cover missed days - streak will be lost on next activity
  return { streak, frozeApplied: false, missedDays };
}

/**
 * Record an activity and update streak
 * Call this when user submits a quiz or logs in
 */
export async function recordActivity(
  userLabel: string,
  subject: StreakSubject,
  activityType: 'quiz_submit' | 'login',
  timezone: string = 'Europe/London'
): Promise<{ streak: UserStreak; isNewDay: boolean; freezeEarned: boolean }> {
  const db = getDb();
  const today = getTodayInTimezone(timezone);
  const overallSubject = isOverallSubject(subject);
  let streak = await getOrCreateUserStreak(userLabel, subject, timezone);

  if (overallSubject) {
    // Pass pre-fetched streak to avoid a redundant Firestore read inside syncOverallFreezeDays.
    // syncOverallFreezeDays returns the locally-constructed updated streak so we don't need
    // to re-read the document afterwards either.
    const syncResult = await syncOverallFreezeDays(userLabel, timezone, streak);
    streak = syncResult.updatedOverall;
  }

  // Check if we already had activity today
  if (streak.lastActivityDate === today) {
    return { streak, isNewDay: false, freezeEarned: false };
  }

  // Record the activity
  // NOTE: Firestore TTL policy should be configured on the streakActivities collection
  // (field: createdAt, expiration: 90 days) via the Firebase console to prevent
  // unbounded document growth. This is not enforced in code.
  await db.collection(COLLECTIONS.STREAK_ACTIVITIES).add({
    userLabel,
    subject,
    date: today,
    activityType,
    createdAt: new Date(),
  });

  // Calculate new streak
  let newStreak = streak.currentStreak;
  let newStreakStartDate = streak.streakStartDate;
  let freezeEarned = false;
  let newFreezeDays = overallSubject ? streak.freezeDays : 0;
  let lastFreezeEarnedAt = overallSubject ? streak.lastFreezeEarnedAt : 0;

  const yesterday = getYesterdayInTimezone(timezone);

  if (!streak.lastActivityDate) {
    // First activity ever - start streak at 1
    newStreak = 1;
    newStreakStartDate = today;
    lastFreezeEarnedAt = 0;
  } else if (streak.lastActivityDate === yesterday) {
    // Consecutive day - increment streak
    newStreak = streak.currentStreak + 1;
  } else {
    // Check for missed days
    const missedDays = daysBetween(streak.lastActivityDate, today) - 1;

    if (missedDays > 0) {
      if (overallSubject) {
        // Check if we have freeze days to cover
        if (streak.freezeDays >= missedDays) {
          // Use freeze days to cover the gap
          newFreezeDays = streak.freezeDays - missedDays;
          newStreak = streak.currentStreak + 1; // Continue streak
        } else if (streak.freezeDays > 0) {
          // Partial coverage - use all freezes but still reset
          newFreezeDays = 0;
          newStreak = 1;
          newStreakStartDate = today;
          lastFreezeEarnedAt = 0;
        } else {
          // No freezes - reset streak
          newStreak = 1;
          newStreakStartDate = today;
          lastFreezeEarnedAt = 0;
        }
      } else {
        // No freezes for non-overall streaks
        newStreak = 1;
        newStreakStartDate = today;
      }
    } else {
      // Same day (shouldn't happen due to earlier check) or future day (shouldn't happen)
      newStreak = streak.currentStreak + 1;
    }
  }

  // Update longest streak
  const newLongestStreak = Math.max(streak.longestStreak, newStreak);

  // Update the document
  const docId = `${userLabel}-${subject}`;
  const docRef = db.collection(COLLECTIONS.USER_STREAKS).doc(docId);
  const newFreezeDaysUsed = overallSubject ? streak.freezeDaysUsed + (streak.freezeDays - newFreezeDays) : 0;
  const updatedAt = new Date();
  await docRef.update({
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    lastActivityDate: today,
    freezeDays: newFreezeDays,
    freezeDaysUsed: newFreezeDaysUsed,
    streakStartDate: newStreakStartDate,
    lastFreezeEarnedAt,
    updatedAt,
  });

  // Construct the updated streak locally instead of re-reading from Firestore
  const updatedStreak: UserStreak = {
    ...streak,
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    lastActivityDate: today,
    freezeDays: newFreezeDays,
    freezeDaysUsed: newFreezeDaysUsed,
    streakStartDate: newStreakStartDate,
    lastFreezeEarnedAt,
    updatedAt,
  };

  const beforeFreezeDays = overallSubject ? streak.freezeDays : 0;
  // Pass the locally-constructed streak to avoid redundant reads inside syncOverallFreezeDays
  const syncResult = await syncOverallFreezeDays(userLabel, timezone, updatedStreak);

  if (overallSubject) {
    const refreshedOverall = syncResult.updatedOverall;
    freezeEarned = refreshedOverall.freezeDays > beforeFreezeDays;
    return { streak: refreshedOverall, isNewDay: true, freezeEarned };
  }

  return { streak: updatedStreak, isNewDay: true, freezeEarned };
}

/**
 * Manually use a freeze day (user clicks freeze button)
 */
export async function useFreeze(
  userLabel: string,
  subject: StreakSubject,
  timezone: string = 'Europe/London'
): Promise<{ success: boolean; message: string; streak: UserStreak }> {
  if (!isOverallSubject(subject)) {
    const streak = await getOrCreateUserStreak(userLabel, subject, timezone);
    return { success: false, message: 'Freeze applies to overall streak only', streak };
  }

  const streak = await getOrCreateUserStreak(userLabel, subject, timezone);
  const today = getTodayInTimezone(timezone);

  // Check if user has freeze days available
  if (streak.freezeDays <= 0) {
    return { success: false, message: 'No freeze days available', streak };
  }

  // Check if user already had activity today
  if (streak.lastActivityDate === today) {
    return { success: false, message: 'Already active today, no need for freeze', streak };
  }

  const yesterday = getYesterdayInTimezone(timezone);

  // Check if there's a missed day to cover
  if (streak.lastActivityDate === yesterday) {
    return { success: false, message: 'No missed days to cover', streak };
  }

  if (!streak.lastActivityDate) {
    return { success: false, message: 'No streak to protect yet', streak };
  }

  // Apply the freeze
  const db = getDb();
  const docId = `${userLabel}-${subject}`;
  const docRef = db.collection(COLLECTIONS.USER_STREAKS).doc(docId);

  await docRef.update({
    freezeDays: streak.freezeDays - 1,
    freezeDaysUsed: streak.freezeDaysUsed + 1,
    // Mark yesterday as covered (keep the streak going)
    lastActivityDate: yesterday,
    updatedAt: new Date(),
  });

  const updatedStreak = await getOrCreateUserStreak(userLabel, subject, timezone);
  return { success: true, message: 'Freeze applied successfully', streak: updatedStreak };
}

/**
 * Get current streak status for display
 */
export async function getStreakStatus(
  userLabel: string,
  subject: StreakSubject,
  timezone: string = 'Europe/London'
): Promise<StreakStatus> {
  const streak = await getOrCreateUserStreak(userLabel, subject, timezone);
  const overallSubject = isOverallSubject(subject);
  const today = getTodayInTimezone(timezone);
  const yesterday = getYesterdayInTimezone(timezone);

  let streakActive = false;
  let daysUntilStreakLoss = 0;
  let frozeToday = false;
  const effectiveFreezeDays = overallSubject ? Math.min(MAX_FREEZES, streak.freezeDays) : 0;
  const earnedFreezes = overallSubject ? getEarnedFreezeCount(await getMaxSubjectStreak(userLabel)) : 0;

  if (!streak.lastActivityDate) {
    // No activity yet
    streakActive = false;
    daysUntilStreakLoss = 0;
  } else if (streak.lastActivityDate === today) {
    // Active today
    streakActive = true;
    daysUntilStreakLoss = 1; // Safe until tomorrow
  } else if (streak.lastActivityDate === yesterday) {
    // Active yesterday - need to act today
    streakActive = true;
    daysUntilStreakLoss = 0; // Must act today
  } else {
    // Missed at least one day
    const missedDays = daysBetween(streak.lastActivityDate, today) - 1;

    if (missedDays <= effectiveFreezeDays) {
      // Can be covered by freezes
      streakActive = true;
      daysUntilStreakLoss = 0;
    } else {
      // Streak is effectively lost
      streakActive = false;
      daysUntilStreakLoss = 0;
    }
  }

  return {
    currentStreak: streak.currentStreak,
    freezeDays: effectiveFreezeDays,
    maxFreezes: overallSubject ? Math.min(MAX_FREEZES, earnedFreezes) : 0,
    streakActive,
    lastActivityDate: streak.lastActivityDate || null,
    daysUntilStreakLoss,
    frozeToday,
  };
}

/**
 * Update user's timezone (call on first login with device timezone)
 */
export async function updateTimezone(
  userLabel: string,
  subject: StreakSubject,
  timezone: string
): Promise<void> {
  const db = getDb();
  const docId = `${userLabel}-${subject}`;
  const docRef = db.collection(COLLECTIONS.USER_STREAKS).doc(docId);
  const doc = await docRef.get();

  if (doc.exists) {
    await docRef.update({ timezone, updatedAt: new Date() });
  } else {
    await getOrCreateUserStreak(userLabel, subject, timezone);
  }
}
