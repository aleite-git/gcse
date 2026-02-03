type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  if (!from) {
    throw new Error('RESEND_FROM_EMAIL is not set');
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${body}`);
  }
}
