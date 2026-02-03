import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { sendEmail } from '@/lib/email';
import {
  ACCOUNT_DELETION_RATE_LIMIT,
  ACCOUNT_DELETION_RATE_WINDOW_MS,
  ACCOUNT_DELETION_CODE_TTL_MS,
  countRecentDeletionRequests,
  createAccountDeletionRequest,
  resolveTimestamp,
} from '@/lib/account-deletion';

const DEFAULT_SUPPORT_URL = 'https://gcse-quiz-997951122924.europe-west1.run.app';

function getDaysRemaining(target: Date, now: Date): number {
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (!user.email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const scheduledFor = resolveTimestamp(user.deletionScheduledFor);
    const now = new Date();
    if (user.deletionStatus === 'pending') {
      if (scheduledFor && scheduledFor.getTime() >= now.getTime()) {
        const daysRemaining = getDaysRemaining(scheduledFor, now);
        return NextResponse.json(
          { error: `Deletion already scheduled. Due in ${daysRemaining} days.` },
          { status: 403 }
        );
      }

      return NextResponse.json({ error: 'Deletion already scheduled.' }, { status: 403 });
    }

    const recentCount = await countRecentDeletionRequests(
      user.id,
      'delete',
      ACCOUNT_DELETION_RATE_WINDOW_MS
    );
    if (recentCount >= ACCOUNT_DELETION_RATE_LIMIT) {
      return NextResponse.json(
        { error: 'Too many deletion requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { requestId, expiresAt, code } = await createAccountDeletionRequest({
      userId: user.id,
      email: user.email,
      type: 'delete',
      ttlMs: ACCOUNT_DELETION_CODE_TTL_MS,
    });

    const supportUrl = 'https://www.quizzwizz.app/';
    await sendEmail({
      to: user.email,
      subject: 'Confirm account deletion',
      text: `Your code is ${code}. This code expires in 15 minutes.\n\nNeed help? ${supportUrl}`,
    });

    return NextResponse.json({
      requestId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Account deletion request error:', error);
    return NextResponse.json(
      { error: 'An error occurred while requesting account deletion' },
      { status: 500 }
    );
  }
}
