import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  janFirst,
  janThirtyFirstDeadline,
} from "@/lib/utils/dates";

describe("formatCurrency", () => {
  it("formats cents as USD", () => {
    expect(formatCurrency(15000)).toBe("$150.00");
  });

  it("formats discounted price", () => {
    expect(formatCurrency(10000)).toBe("$100.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats partial dollars", () => {
    expect(formatCurrency(1550)).toBe("$15.50");
  });
});

describe("janFirst", () => {
  it("returns Jan 1 at midnight UTC", () => {
    const date = janFirst(2027);
    expect(date.getUTCFullYear()).toBe(2027);
    expect(date.getUTCMonth()).toBe(0);
    expect(date.getUTCDate()).toBe(1);
    expect(date.getUTCHours()).toBe(0);
  });
});

describe("janThirtyFirstDeadline", () => {
  it("returns Feb 1 at 04:59:59 UTC (Jan 31 23:59:59 ET)", () => {
    const date = janThirtyFirstDeadline(2027);
    expect(date.getUTCFullYear()).toBe(2027);
    expect(date.getUTCMonth()).toBe(1); // February
    expect(date.getUTCDate()).toBe(1);
    expect(date.getUTCHours()).toBe(4);
    expect(date.getUTCMinutes()).toBe(59);
    expect(date.getUTCSeconds()).toBe(59);
  });
});
