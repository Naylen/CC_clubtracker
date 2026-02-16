/**
 * Test data factories for creating test fixtures.
 */

export function createTestHousehold(overrides = {}) {
  return {
    name: "Test Family",
    addressLine1: "123 Main St",
    city: "Mt Sterling",
    state: "KY",
    zip: "40353",
    email: `test-${Date.now()}@example.com`,
    ...overrides,
  };
}

export function createTestMember(householdId: string, overrides = {}) {
  return {
    householdId,
    firstName: "John",
    lastName: "Test",
    dateOfBirth: "1985-06-15",
    role: "PRIMARY" as const,
    isVeteranDisabled: false,
    isAdmin: false,
    ...overrides,
  };
}

export function createTestMembershipYear(overrides = {}) {
  const year = new Date().getFullYear() + 1;
  return {
    year,
    opensAt: new Date(`${year}-01-01T00:00:00Z`).toISOString(),
    renewalDeadline: new Date(`${year}-02-01T04:59:59Z`).toISOString(),
    capacityCap: 350,
    ...overrides,
  };
}
