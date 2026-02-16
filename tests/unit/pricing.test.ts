import { describe, it, expect } from "vitest";
import { calculatePrice, getAgeOnDate } from "@/lib/utils/pricing";

describe("getAgeOnDate", () => {
  it("calculates age correctly when birthday has passed", () => {
    expect(getAgeOnDate("1960-06-15", "2026-07-01")).toBe(66);
  });

  it("calculates age correctly when birthday has not passed", () => {
    expect(getAgeOnDate("1960-06-15", "2026-03-01")).toBe(65);
  });

  it("calculates age correctly on birthday", () => {
    expect(getAgeOnDate("1960-06-15", "2026-06-15")).toBe(66);
  });

  it("calculates age correctly on Jan 1", () => {
    expect(getAgeOnDate("1961-01-01", "2026-01-01")).toBe(65);
  });

  it("returns age before birthday in birth month", () => {
    expect(getAgeOnDate("1961-01-02", "2026-01-01")).toBe(64);
  });
});

describe("calculatePrice", () => {
  // BR-4: Standard pricing
  it("returns $150 for non-veteran under 65", () => {
    const result = calculatePrice({
      dateOfBirth: "1990-05-10",
      isVeteranDisabled: false,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(15000);
    expect(result.discountType).toBe("NONE");
  });

  // BR-4: Disabled veteran discount
  it("returns $100 for disabled veteran", () => {
    const result = calculatePrice({
      dateOfBirth: "1990-05-10",
      isVeteranDisabled: true,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(10000);
    expect(result.discountType).toBe("VETERAN");
  });

  // BR-4: Senior discount — age 65 on Jan 1
  it("returns $100 for member age 65 on Jan 1 of membership year", () => {
    const result = calculatePrice({
      dateOfBirth: "1960-06-15",
      isVeteranDisabled: false,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(10000);
    expect(result.discountType).toBe("SENIOR");
  });

  // BR-4: Senior discount — exactly 65 on Jan 1
  it("returns $100 for member born on Jan 1, 65 years ago", () => {
    const result = calculatePrice({
      dateOfBirth: "1961-01-01",
      isVeteranDisabled: false,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(10000);
    expect(result.discountType).toBe("SENIOR");
  });

  // BR-4: Not yet 65 on Jan 1
  it("returns $150 for member age 64 on Jan 1", () => {
    const result = calculatePrice({
      dateOfBirth: "1961-01-02",
      isVeteranDisabled: false,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(15000);
    expect(result.discountType).toBe("NONE");
  });

  // BR-5: Veteran takes priority over senior
  it("returns VETERAN discount type for disabled veteran age 70", () => {
    const result = calculatePrice({
      dateOfBirth: "1955-03-20",
      isVeteranDisabled: true,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(10000);
    expect(result.discountType).toBe("VETERAN");
  });

  // BR-5: Non-veteran senior
  it("returns SENIOR discount type for non-veteran age 70", () => {
    const result = calculatePrice({
      dateOfBirth: "1955-03-20",
      isVeteranDisabled: false,
      membershipYear: 2026,
    });
    expect(result.priceCents).toBe(10000);
    expect(result.discountType).toBe("SENIOR");
  });
});
