import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { broadcastAttachment, member } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/utils/audit";

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) return null;
  return { adminMember: adminMember[0] };
}

const SAFE_INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select()
    .from(broadcastAttachment)
    .where(eq(broadcastAttachment.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeFilename = row.filename
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, "")
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "");

  const mimeType = SAFE_INLINE_MIME.has(row.mimeType)
    ? row.mimeType
    : "application/octet-stream";

  // Inline images are previewed; non-inline render as attachments in the
  // browser. Either way we tag X-Content-Type-Options to prevent sniffing.
  const disposition = row.isInline ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({
      id: broadcastAttachment.id,
      draftId: broadcastAttachment.draftId,
      communicationsLogId: broadcastAttachment.communicationsLogId,
      filename: broadcastAttachment.filename,
    })
    .from(broadcastAttachment)
    .where(eq(broadcastAttachment.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only allow deletion while still attached to a draft. Once linked to a
  // sent/scheduled broadcast, the binary stays for the audit/preview record.
  if (!existing.draftId || existing.communicationsLogId) {
    return NextResponse.json(
      { error: "Attachment is locked to a broadcast" },
      { status: 409 },
    );
  }

  await db
    .delete(broadcastAttachment)
    .where(eq(broadcastAttachment.id, id));

  await recordAudit({
    actorId: adminSession.adminMember.id,
    actorType: "ADMIN",
    action: "broadcast_attachment.delete",
    entityType: "broadcast_attachment",
    entityId: id,
    metadata: {
      draftId: existing.draftId,
      filename: existing.filename,
    },
  });

  return NextResponse.json({ success: true });
}
