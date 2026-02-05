import { getDb, COLLECTIONS } from './firebase';
import type { ActiveSubject } from './active-subjects';

export type UserProfileRecord = {
  id: string;
  label: string;
  labelLower: string;
  activeSubjects: ActiveSubject[];
  onboardingComplete: boolean;
  subscriptionStart?: Date | { toDate: () => Date } | number | null;
  subscriptionExpiry?: Date | { toDate: () => Date } | number | null;
  graceUntil?: Date | { toDate: () => Date } | number | null;
  subscriptionProvider?: string | null;
  entitlement?: 'premium' | 'free' | 'none' | null;
  subscriptionStatus?: 'active' | 'grace' | 'expired' | 'unknown' | null;
  productId?: string | null;
  store?: string | null;
  environment?: string | null;
  revenueCatAppUserId?: string | null;
  lastRevenueCatEventId?: string | null;
  adminOverride?: boolean | null;
  createdAt: Date;
};

type FirestoreUserProfile = Omit<UserProfileRecord, 'id'>;

export function createUserProfileStore() {
  const collection = getDb().collection(COLLECTIONS.USER_PROFILES);

  return {
    async getByLabel(labelLower: string): Promise<UserProfileRecord | null> {
      const snapshot = await collection.where('labelLower', '==', labelLower).limit(1).get();
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as FirestoreUserProfile) };
    },
    async createProfile(profile: Omit<UserProfileRecord, 'id'>): Promise<UserProfileRecord> {
      const ref = await collection.add(profile);
      return { id: ref.id, ...profile };
    },
    async updateProfile(
      userId: string,
      update: { activeSubjects?: ActiveSubject[]; onboardingComplete?: boolean }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
  };
}
