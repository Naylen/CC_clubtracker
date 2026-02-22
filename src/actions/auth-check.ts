"use server";

import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Lightweight role check for post-login redirect.
 * Returns { isAdmin } if authenticated, null otherwise.
 */
export async function checkUserRole(): Promise<{ isAdmin: boolean } | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;

    const memberRecord = await db
      .select({ isAdmin: member.isAdmin })
      .from(member)
      .where(eq(member.email, session.user.email))
      .limit(1);

    return { isAdmin: memberRecord[0]?.isAdmin ?? false };
  } catch {
    return null;
  }
}
