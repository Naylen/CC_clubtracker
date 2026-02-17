"use server";

import { db } from "@/lib/db";
import { membershipTier, member } from "@/lib/db/schema";
import { membershipTierSchema } from "@/lib/validators/membership";
import { recordAudit } from "@/lib/utils/audit";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ActionResult } from "@/types";

async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  const adminMember = await db
    .select()
    .from(member)
    .where(eq(member.email, session.user.email))
    .limit(1);
  if (!adminMember[0]?.isAdmin) throw new Error("Forbidden: Admin only");
  return { session, adminMember: adminMember[0] };
}

/**
 * Get all membership tiers (admin view — includes inactive).
 */
export async function getAllMembershipTiers() {
  await getAdminSession();
  return db
    .select()
    .from(membershipTier)
    .orderBy(asc(membershipTier.sortOrder), asc(membershipTier.name));
}

/**
 * Get only active membership tiers (for dropdowns / public use).
 */
export async function getMembershipTiers() {
  return db
    .select()
    .from(membershipTier)
    .where(eq(membershipTier.isActive, true))
    .orderBy(asc(membershipTier.sortOrder), asc(membershipTier.name));
}

/**
 * Get a single membership tier by ID.
 */
export async function getMembershipTierById(id: string) {
  await getAdminSession();
  const result = await db
    .select()
    .from(membershipTier)
    .where(eq(membershipTier.id, id))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Create a new membership tier.
 */
export async function createMembershipTier(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const { adminMember } = await getAdminSession();
    const data = membershipTierSchema.parse(input);

    const [created] = await db
      .insert(membershipTier)
      .values({
        name: data.name,
        description: data.description ?? null,
        priceCents: data.priceCents,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      })
      .returning({ id: membershipTier.id });

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership_tier.create",
      entityType: "membership_tier",
      entityId: created.id,
      metadata: { name: data.name, priceCents: data.priceCents },
    });

    return { success: true, data: { id: created.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update an existing membership tier.
 */
export async function updateMembershipTier(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();
    const data = membershipTierSchema.parse(input);

    await db
      .update(membershipTier)
      .set({
        name: data.name,
        description: data.description ?? null,
        priceCents: data.priceCents,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      })
      .where(eq(membershipTier.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "membership_tier.update",
      entityType: "membership_tier",
      entityId: id,
      metadata: { name: data.name, priceCents: data.priceCents },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Toggle a membership tier's active status.
 */
export async function toggleMembershipTier(
  id: string
): Promise<ActionResult> {
  try {
    const { adminMember } = await getAdminSession();

    const existing = await db
      .select()
      .from(membershipTier)
      .where(eq(membershipTier.id, id))
      .limit(1);

    if (!existing[0]) {
      return { success: false, error: "Tier not found" };
    }

    const newStatus = !existing[0].isActive;

    await db
      .update(membershipTier)
      .set({ isActive: newStatus })
      .where(eq(membershipTier.id, id));

    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: newStatus
        ? "membership_tier.activate"
        : "membership_tier.deactivate",
      entityType: "membership_tier",
      entityId: id,
      metadata: { name: existing[0].name, isActive: newStatus },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
