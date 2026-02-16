import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "MCFGC <noreply@mcfgcinc.com>";

/**
 * Send a magic link email for member authentication.
 */
export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "MCFGC - Sign In Link",
    html: `
      <h2>Montgomery County Fish & Game Club</h2>
      <p>Click the link below to sign in to your member portal:</p>
      <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#1a5632;color:#fff;text-decoration:none;border-radius:6px;">Sign In</a></p>
      <p>This link expires in 10 minutes.</p>
      <p style="color:#666;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}

/**
 * Send a renewal reminder email.
 */
export async function sendRenewalReminder(
  email: string,
  householdName: string,
  year: number,
  portalUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `MCFGC ${year} Membership Renewal`,
    html: `
      <h2>Montgomery County Fish & Game Club</h2>
      <p>Hello ${householdName},</p>
      <p>It's time to renew your MCFGC membership for ${year}.</p>
      <p>Payment must be received by <strong>January 31, ${year}</strong> to maintain your membership. After that date, your slot becomes available to new applicants.</p>
      <p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#1a5632;color:#fff;text-decoration:none;border-radius:6px;">Renew Now</a></p>
      <p style="color:#666;font-size:12px;">Montgomery County Fish & Game Club · 6701 Old Nest Egg Rd, Mt Sterling, KY 40353</p>
    `,
  });
}

interface BroadcastEmailParams {
  to: string[];
  subject: string;
  body: string;
}

/**
 * Send a broadcast email to multiple recipients using Resend batch API.
 */
export async function sendBroadcastEmail(
  params: BroadcastEmailParams
): Promise<string | undefined> {
  const emails = params.to.map((email) => ({
    from: FROM_ADDRESS,
    to: email,
    subject: params.subject,
    html: `
      <div style="max-width:600px;margin:0 auto;">
        <h2 style="color:#1a5632;">Montgomery County Fish & Game Club</h2>
        ${params.body}
        <hr style="margin-top:32px;border:none;border-top:1px solid #ddd;" />
        <p style="color:#666;font-size:12px;">6701 Old Nest Egg Rd, Mt Sterling, KY 40353</p>
      </div>
    `,
  }));

  const result = await resend.batch.send(emails);
  // Return the batch ID from the first result for tracking
  return result.data?.data?.[0]?.id;
}
