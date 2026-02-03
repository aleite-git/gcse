import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import {
  ACCOUNT_DELETION_MAX_ATTEMPTS,
  getAccountDeletionRequest,
  resolveTimestamp,
  updateAccountDeletionRequest,
  verifyVerificationCode,
} from '@/lib/account-deletion';

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!requestId || !code) {
      return NextResponse.json({ error: 'requestId and code are required' }, { status: 400 });
    }

    const store = createFirestoreMobileUserStore();
    const user = await store.getByUsername(session.label.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.oauthProvider) {
      return NextResponse.json(
        { error: 'Account deletion is only available for email/password accounts' },
        { status: 400 }
      );
    }

    const deletionRequest = await getAccountDeletionRequest(requestId);
    if (!deletionRequest || deletionRequest.userId !== user.id) {
      return NextResponse.json({ error: 'Invalid requestId or code' }, { status: 400 });
    }

    if (deletionRequest.type !== 'cancel') {
      return NextResponse.json({ error: 'Invalid requestId or code' }, { status: 400 });
    }

    if (deletionRequest.status === 'verified') {
      return NextResponse.json({ error: 'Deletion cancellation already confirmed' }, { status: 409 });
    }

    if (deletionRequest.status === 'cancelled') {
      return NextResponse.json({ error: 'Deletion cancellation was cancelled' }, { status: 409 });
    }

    const now = new Date();
    const expiresAt = resolveTimestamp(deletionRequest.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) {
      if (deletionRequest.status !== 'expired') {
        await updateAccountDeletionRequest(deletionRequest.id, { status: 'expired' });
      }
      return NextResponse.json({ error: 'Code expired' }, { status: 410 });
    }

    const attempts = deletionRequest.attemptCount || 0;
    if (attempts >= ACCOUNT_DELETION_MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const isValid = await verifyVerificationCode(code, deletionRequest.codeHash);
    if (!isValid) {
      const nextAttempts = attempts + 1;
      await updateAccountDeletionRequest(deletionRequest.id, { attemptCount: nextAttempts });
      if (nextAttempts >= ACCOUNT_DELETION_MAX_ATTEMPTS) {
        return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
      }
      return NextResponse.json({ error: 'Invalid requestId or code' }, { status: 400 });
    }

    if (user.deletionStatus === 'cancelled' || !user.deletionScheduledFor) {
      return NextResponse.json({ error: 'Deletion already cancelled' }, { status: 409 });
    }

    await updateAccountDeletionRequest(deletionRequest.id, { status: 'verified' });
    await store.updateDeletion(user.id, {
      deletionScheduledFor: null,
      deletionCancelledAt: now,
      deletionStatus: 'cancelled',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account deletion cancellation confirm error:', error);
    return NextResponse.json(
      { error: 'An error occurred while confirming deletion cancellation' },
      { status: 500 }
    );
  }
}
