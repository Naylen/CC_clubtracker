import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { decryptBuffer } from "@/lib/utils/encryption";
import { recordAudit } from "@/lib/utils/audit";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) return null;
  return { session, adminMember: adminMember[0] };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const adminSession = await getAdminSession();
    if (!adminSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;

    const target = await db
      .select({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        veteranDocEncrypted: member.veteranDocEncrypted,
        veteranDocFilename: member.veteranDocFilename,
        veteranDocMimeType: member.veteranDocMimeType,
      })
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!target[0]) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (!target[0].veteranDocEncrypted) {
      return NextResponse.json(
        { error: "No veteran document on file" },
        { status: 404 }
      );
    }

    // Decrypt the file
    const decryptedBuffer = decryptBuffer(target[0].veteranDocEncrypted);

    // Log the access
    await recordAudit({
      actorId: adminSession.adminMember.id,
      actorType: "ADMIN",
      action: "encrypted_data.view_veteran_doc",
      entityType: "member",
      entityId: memberId,
      metadata: {
        memberName: `${target[0].firstName} ${target[0].lastName}`,
        filename: target[0].veteranDocFilename,
      },
    });

    // Return the file with proper headers
    return new NextResponse(decryptedBuffer, {
      headers: {
        "Content-Type": target[0].veteranDocMimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${target[0].veteranDocFilename ?? "veteran-doc"}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error serving veteran document:", error);
    return NextResponse.json(
      { error: "Failed to retrieve document" },
      { status: 500 }
    );
  }
}
