import type { DiscountType } from "@/types";

const STANDARD_PRICE_CENTS = 15000;
const DISCOUNTED_PRICE_CENTS = 10000;

interface PricingInput {
  dateOfBirth: string;
  isVeteranDisabled: boolean;
  membershipYear: number;
}

interface PricingResult {
  priceCents: number;
  discountType: DiscountType;
}

/**
 * Calculate membership price based on veteran status and age.
 *
 * BR-4: Standard $150, disabled veteran $100, age ≥ 65 $100.
 * BR-5: Veteran discount takes priority for tracking if both apply.
 *
 * Age is calculated as of Jan 1 of the membership year.
 */
export function calculatePrice(input: PricingInput): PricingResult {
  // BR-5: Veteran discount takes precedence
  if (input.isVeteranDisabled) {
    return { priceCents: DISCOUNTED_PRICE_CENTS, discountType: "VETERAN" };
  }

  // Check senior discount: age ≥ 65 on Jan 1 of the membership year
  const ageOnJanFirst = getAgeOnDate(
    input.dateOfBirth,
    `${input.membershipYear}-01-01`
  );

  if (ageOnJanFirst >= 65) {
    return { priceCents: DISCOUNTED_PRICE_CENTS, discountType: "SENIOR" };
  }

  return { priceCents: STANDARD_PRICE_CENTS, discountType: "NONE" };
}

/**
 * Calculate age in completed years on a given reference date.
 * Both dates are ISO format strings: YYYY-MM-DD.
 */
export function getAgeOnDate(
  dateOfBirth: string,
  referenceDate: string
): number {
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
  const [refYear, refMonth, refDay] = referenceDate.split("-").map(Number);

  let age = refYear - birthYear;

  // If birthday hasn't occurred yet in the reference year, subtract 1
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age--;
  }

  return age;
}
