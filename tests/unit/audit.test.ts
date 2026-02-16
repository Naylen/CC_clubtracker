import { describe, it, expect, vi } from "vitest";

// Mock the database
const insertMock = vi.fn(() => ({
  values: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: insertMock,
  },
}));

vi.mock("@/lib/db/schema", () => ({
  auditLog: "audit_log_table",
}));

describe("audit log (BR-9)", () => {
  it("creates audit entry with required fields", async () => {
    const { recordAudit } = await import("@/lib/utils/audit");

    await recordAudit({
      actorId: "admin-123",
      actorType: "ADMIN",
      action: "household.create",
      entityType: "household",
      entityId: "household-456",
      metadata: { name: "Test Family" },
    });

    expect(insertMock).toHaveBeenCalled();
  });

  it("allows null actorId for SYSTEM actions", async () => {
    const { recordAudit } = await import("@/lib/utils/audit");

    await recordAudit({
      actorId: null,
      actorType: "SYSTEM",
      action: "membership.lapse",
      entityType: "membership",
      entityId: "membership-789",
    });

    expect(insertMock).toHaveBeenCalled();
  });
});
