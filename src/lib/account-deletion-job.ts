import { getDb, COLLECTIONS } from './firebase';

type DeleteResult = {
  processed: number;
  deleted: number;
  errors: number;
};

const DELETE_BATCH_SIZE = 300;

async function deleteByQuery(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
): Promise<number> {
  let deletedCount = 0;
  let snapshot = await query.limit(DELETE_BATCH_SIZE).get();

  while (!snapshot.empty) {
    const batch = getDb().batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    deletedCount += snapshot.size;
    await batch.commit();
    snapshot = await query.limit(DELETE_BATCH_SIZE).get();
  }

  return deletedCount;
}

async function deleteUserData(params: {
  userId: string;
  username: string;
}): Promise<void> {
  const db = getDb();
  const usernameLower = params.username.toLowerCase();

  await deleteByQuery(
    db.collection(COLLECTIONS.ATTEMPTS).where('userLabel', '==', params.username)
  );
  await deleteByQuery(
    db.collection(COLLECTIONS.QUESTION_STATS).where('userLabel', '==', params.username)
  );
  await deleteByQuery(
    db.collection(COLLECTIONS.USER_STREAKS).where('userLabel', '==', params.username)
  );
  await deleteByQuery(
    db.collection(COLLECTIONS.STREAK_ACTIVITIES).where('userLabel', '==', params.username)
  );
  await deleteByQuery(
    db.collection(COLLECTIONS.USER_PROFILES).where('labelLower', '==', usernameLower)
  );
  await deleteByQuery(
    db.collection(COLLECTIONS.ACCOUNT_DELETION_REQUESTS).where('userId', '==', params.userId)
  );

  await db.collection(COLLECTIONS.MOBILE_USERS).doc(params.userId).delete();
}

export async function runAccountDeletionJob(): Promise<DeleteResult> {
  const db = getDb();
  const now = new Date();
  const result: DeleteResult = { processed: 0, deleted: 0, errors: 0 };

  const snapshot = await db
    .collection(COLLECTIONS.MOBILE_USERS)
    .where('deletionStatus', '==', 'pending')
    .where('deletionScheduledFor', '<=', now)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data() as { username?: string };
    result.processed += 1;

    if (!data.username) {
      result.errors += 1;
      continue;
    }

    try {
      await deleteUserData({ userId: doc.id, username: data.username });
      result.deleted += 1;
    } catch (error) {
      console.error('Account deletion job failed for user', doc.id, error);
      result.errors += 1;
    }
  }

  return result;
}
