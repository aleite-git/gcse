import { NextResponse } from 'next/server';
import { runAccountDeletionJob } from '@/lib/account-deletion-job';

const SECRET_HEADER = 'x-cron-secret';

export async function POST(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const provided = request.headers.get(SECRET_HEADER);
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runAccountDeletionJob();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Account deletion job run error:', error);
    return NextResponse.json(
      { error: 'An error occurred while running the account deletion job' },
      { status: 500 }
    );
  }
}
