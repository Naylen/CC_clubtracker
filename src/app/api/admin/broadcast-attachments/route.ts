import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@/lib/db";
import { broadcastAttachment, member } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { recordAudit } from "@/lib/utils/audit";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

const ALLOWED_INLINE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const ALLOWED_FILE_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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

const uploadFieldsSchema = z.object({
  draftId: z.uuid(),
  isInline: z.enum(["true", "false"]),
});

export async function POST(request: NextRequest) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const fieldsResult = uploadFieldsSchema.safeParse({
    draftId: formData.get("draftId"),
    isInline: formData.get("isInline"),
  });
  if (!fieldsResult.success) {
    return NextResponse.json(
      { error: "Invalid upload metadata" },
      { status: 400 },
    );
  }
  const { draftId, isInline: isInlineStr } = fieldsResult.data;
  const isInline = isInlineStr === "true";

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit` },
      { status: 413 },
    );
  }

  const allowed = isInline ? ALLOWED_INLINE_MIME : ALLOWED_FILE_MIME;
  if (!allowed.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const [row] = await db
    .insert(broadcastAttachment)
    .values({
      draftId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      isInline,
      data: buffer,
      createdByAdminId: adminSession.adminMember.id,
    })
    .returning({ id: broadcastAttachment.id });

  await recordAudit({
    actorId: adminSession.adminMember.id,
    actorType: "ADMIN",
    action: "broadcast_attachment.upload",
    entityType: "broadcast_attachment",
    entityId: row.id,
    metadata: {
      draftId,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      isInline,
    },
  });

  return NextResponse.json({
    id: row.id,
    contentId: `att-${row.id}`,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    isInline,
    previewUrl: `/api/admin/broadcast-attachments/${row.id}`,
  });
}
