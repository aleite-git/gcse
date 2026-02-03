import { getDb, COLLECTIONS } from '@/lib/firebase';
import { MobileUserRecord, MobileUserStore, NewMobileUser } from './mobile-auth';
import type { ActiveSubject } from './active-subjects';

type FirestoreMobileUser = Omit<MobileUserRecord, 'id'>;

export function createFirestoreMobileUserStore(): MobileUserStore {
  const collection = getDb().collection(COLLECTIONS.MOBILE_USERS);

  return {
    async getById(userId: string): Promise<MobileUserRecord | null> {
      const doc = await collection.doc(userId).get();
      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...(doc.data() as FirestoreMobileUser) };
    },
    async getByEmail(emailLower: string): Promise<MobileUserRecord | null> {
      const snapshot = await collection.where('emailLower', '==', emailLower).limit(1).get();
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as FirestoreMobileUser) };
    },
    async getByUsername(usernameLower: string): Promise<MobileUserRecord | null> {
      const snapshot = await collection.where('usernameLower', '==', usernameLower).limit(1).get();
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as FirestoreMobileUser) };
    },
    async getByOAuth(
      provider: 'google' | 'apple',
      subject: string
    ): Promise<MobileUserRecord | null> {
      const snapshot = await collection
        .where('oauthProvider', '==', provider)
        .where('oauthSubject', '==', subject)
        .limit(1)
        .get();
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as FirestoreMobileUser) };
    },
    async createUser(user: NewMobileUser): Promise<MobileUserRecord> {
      const ref = await collection.add(user);
      return { id: ref.id, ...user };
    },
    async updateUsername(
      userId: string,
      update: { username: string; usernameLower: string; usernameChangedAt: Date }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
    async updateOAuth(
      userId: string,
      update: { oauthProvider: 'google' | 'apple'; oauthSubject: string }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
    async updateProfile(
      userId: string,
      update: { activeSubjects?: ActiveSubject[]; onboardingComplete?: boolean }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
    async updateSubscription(
      userId: string,
      update: {
        subscriptionStart?: Date | null;
        subscriptionExpiry?: Date | null;
        graceUntil?: Date | null;
        subscriptionProvider?: string | null;
      }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
    async updateAdminOverride(userId: string, adminOverride: boolean): Promise<void> {
      await collection.doc(userId).update({ adminOverride });
    },
    async updateDeletion(
      userId: string,
      update: {
        deletionRequestedAt?: Date | null;
        deletionScheduledFor?: Date | null;
        deletionCancelledAt?: Date | null;
        deletionStatus?: 'none' | 'pending' | 'cancelled' | 'deleted';
      }
    ): Promise<void> {
      await collection.doc(userId).update(update);
    },
  };
}
