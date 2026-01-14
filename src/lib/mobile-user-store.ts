import { getDb, COLLECTIONS } from './firebase';
import { MobileUserRecord, MobileUserStore, NewMobileUser } from './mobile-auth';
import type { ActiveSubject } from './active-subjects';

type FirestoreMobileUser = Omit<MobileUserRecord, 'id'>;

export function createFirestoreMobileUserStore(): MobileUserStore {
  const collection = getDb().collection(COLLECTIONS.MOBILE_USERS);

  return {
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
      update: { username: string; usernameLower: string; usernameChangeCount: number }
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
  };
}
