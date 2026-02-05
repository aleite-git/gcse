import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { sendEmail } from '@/lib/email';

declare const global: typeof globalThis;

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  global.fetch = jest.fn();
});

describe('email', () => {
  it('throws if API key is missing', async () => {
    await expect(sendEmail({ to: 'a@example.com', subject: 'hi', text: 'hello' })).rejects.toThrow(
      'RESEND_API_KEY is not set'
    );
  });

  it('throws if from address is missing', async () => {
    process.env.RESEND_API_KEY = 'key';
    await expect(sendEmail({ to: 'a@example.com', subject: 'hi', text: 'hello' })).rejects.toThrow(
      'RESEND_FROM_EMAIL is not set'
    );
  });

  it('sends email when configured', async () => {
    process.env.RESEND_API_KEY = 'key';
    process.env.RESEND_FROM_EMAIL = 'from@example.com';

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '' });

    await sendEmail({ to: 'a@example.com', subject: 'hi', text: 'hello' });
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when the email API returns an error', async () => {
    process.env.RESEND_API_KEY = 'key';
    process.env.RESEND_FROM_EMAIL = 'from@example.com';

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'bad',
    });

    await expect(sendEmail({ to: 'a@example.com', subject: 'hi', text: 'hello' })).rejects.toThrow(
      'Resend email failed: 500 bad'
    );
  });
});
