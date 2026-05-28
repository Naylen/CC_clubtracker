import { Resend } from "resend";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastAttachment } from "@/lib/db/schema";

/**
 * Lazy-initialized Resend client.
 * Deferred so the module can be imported at build time without
 * RESEND_API_KEY being present in the environment.
 */
let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/**
 * Derive the Resend "from" address from APP_DOMAIN (production)
 * or fall back to a hardcoded default (development).
 */
function getResendFromAddress(): string {
  const domain = process.env.APP_DOMAIN;
  if (domain) {
    return `MCFGC <noreply@${domain}>`;
  }
  return "MCFGC <noreply@mcfgcinc.com>";
}

export type EmailProvider = "resend" | "gmail";

/**
 * Check which email providers are configured and available.
 */
export function getAvailableProviders(): { provider: EmailProvider; label: string }[] {
  const providers: { provider: EmailProvider; label: string }[] = [];

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder") {
    providers.push({ provider: "resend", label: "Resend" });
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    providers.push({
      provider: "gmail",
      label: `Gmail (${process.env.GMAIL_USER})`,
    });
  }

  return providers;
}

/**
 * Create a nodemailer transport for Gmail SMTP.
 */
function getGmailTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
  });
}

/**
 * Get the From address for the given provider.
 */
function getFromAddress(provider: EmailProvider): string {
  if (provider === "gmail") {
    return `MCFGC <${process.env.GMAIL_USER}>`;
  }
  return getResendFromAddress();
}

/**
 * Send a magic link email for member authentication.
 */
export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  await getResend().emails.send({
    from: getResendFromAddress(),
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
  await getResend().emails.send({
    from: getResendFromAddress(),
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

export interface BroadcastAttachment {
  id: string;
  filename: string;
  mimeType: string;
  isInline: boolean;
  data: Buffer;
}

/**
 * Fetch attachment rows (including binary payload) for a sent or scheduled
 * broadcast. Returns an empty array if none are attached, so callers can
 * forward the result to `sendBroadcastEmail` unconditionally.
 */
export async function loadBroadcastAttachments(
  communicationsLogId: string,
): Promise<BroadcastAttachment[]> {
  const rows = await db
    .select({
      id: broadcastAttachment.id,
      filename: broadcastAttachment.filename,
      mimeType: broadcastAttachment.mimeType,
      isInline: broadcastAttachment.isInline,
      data: broadcastAttachment.data,
    })
    .from(broadcastAttachment)
    .where(eq(broadcastAttachment.communicationsLogId, communicationsLogId));
  return rows;
}

interface BroadcastEmailParams {
  to: string[];
  subject: string;
  body: string;
  provider?: EmailProvider;
  attachments?: BroadcastAttachment[];
}

/**
 * Rewrite in-app preview URLs to cid: references for inline attachments
 * so the recipient's mail client resolves them against the MIME parts we
 * attach. URLs are unique by attachment id, so the replace is safe.
 */
function rewriteInlineAttachmentRefs(
  body: string,
  attachments: BroadcastAttachment[],
): string {
  let out = body;
  for (const a of attachments) {
    if (!a.isInline) continue;
    const url = `/api/admin/broadcast-attachments/${a.id}`;
    out = out.split(url).join(`cid:att-${a.id}`);
  }
  return out;
}

/**
 * Wrap broadcast HTML body with the standard email template.
 */
export function wrapBroadcastHtml(body: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;">
      <h2 style="color:#1a5632;">Montgomery County Fish & Game Club</h2>
      ${body}
      <hr style="margin-top:32px;border:none;border-top:1px solid #ddd;" />
      <p style="color:#666;font-size:12px;">6701 Old Nest Egg Rd, Mt Sterling, KY 40353</p>
    </div>
  `;
}

/**
 * Send a broadcast email to multiple recipients.
 * Routes to Resend batch API or Gmail SMTP based on provider.
 */
export async function sendBroadcastEmail(
  params: BroadcastEmailParams
): Promise<string | undefined> {
  const provider = params.provider ?? "resend";
  const from = getFromAddress(provider);
  const attachments = params.attachments ?? [];
  const rewrittenBody = rewriteInlineAttachmentRefs(params.body, attachments);
  const html = wrapBroadcastHtml(rewrittenBody);

  if (provider === "gmail") {
    return sendBroadcastViaGmail({ ...params, from, html, attachments });
  }

  return sendBroadcastViaResend({ ...params, from, html, attachments });
}

/**
 * Send broadcast via Resend batch API.
 *
 * For inline images, Resend's REST API accepts a `content_id` field on each
 * attachment that matches the `cid:` value in the HTML. The Node SDK's
 * static type doesn't include that field yet — we widen with a cast so the
 * snake_case key reaches the wire as-is.
 */
async function sendBroadcastViaResend(params: {
  to: string[];
  subject: string;
  from: string;
  html: string;
  attachments: BroadcastAttachment[];
}): Promise<string | undefined> {
  const resendAttachments = params.attachments.map((a) => ({
    filename: a.filename,
    content: a.data,
    contentType: a.mimeType,
    content_id: a.isInline ? `att-${a.id}` : undefined,
    content_disposition: a.isInline ? "inline" : "attachment",
  }));

  const emails = params.to.map((email) => ({
    from: params.from,
    to: email,
    subject: params.subject,
    html: params.html,
    ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
  }));

  const result = await getResend().batch.send(
    emails as unknown as Parameters<
      ReturnType<typeof getResend>["batch"]["send"]
    >[0],
  );
  return result.data?.data?.[0]?.id;
}

/**
 * Send broadcast via Gmail SMTP.
 * Sends each email individually with a small delay to avoid rate limits.
 * Gmail limit: ~500/day for personal, ~2000/day for Workspace.
 */
async function sendBroadcastViaGmail(params: {
  to: string[];
  subject: string;
  from: string;
  html: string;
  attachments: BroadcastAttachment[];
}): Promise<string | undefined> {
  const transport = getGmailTransport();
  const mailAttachments = params.attachments.map((a) => ({
    filename: a.filename,
    content: a.data,
    contentType: a.mimeType,
    cid: a.isInline ? `att-${a.id}` : undefined,
    contentDisposition: a.isInline
      ? ("inline" as const)
      : ("attachment" as const),
  }));
  let sentCount = 0;

  for (const recipient of params.to) {
    await transport.sendMail({
      from: params.from,
      to: recipient,
      subject: params.subject,
      html: params.html,
      attachments: mailAttachments,
    });
    sentCount++;

    // Small delay between emails to avoid Gmail rate limits
    if (sentCount < params.to.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  transport.close();

  // Return a tracking ID for Gmail sends
  return `gmail-batch-${Date.now()}-${sentCount}`;
}
