"use server";

import { db } from "@/lib/db";
import { member, household, membership, membershipYear } from "@/lib/db/schema";
import { recordAudit } from "@/lib/utils/audit";
import { calculatePrice } from "@/lib/utils/pricing";
import { getCapacityDisplay } from "@/lib/utils/capacity";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod/v4";
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

/** Schema for a single row in the CSV import */
const importRowSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Invalid email"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  isVeteranDisabled: z.boolean().default(false),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
  phone: z.string().optional(),
  driverLicenseState: z.string().length(2, "DL state must be 2 characters").optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
});

export interface ImportRowError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, string>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportRowError[];
}

/**
 * Parse a CSV string into an array of row objects.
 * Handles quoted fields and commas within quotes.
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header row
  const headerFields = parseCSVLine(lines[0]);
  const normalizedHeaders = headerFields.map((h) =>
    h.trim().toLowerCase().replace(/[\s_]+/g, "")
  );

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      row[normalizedHeaders[j]] = (fields[j] ?? "").trim();
    }
    rows.push(row);
  }

  return rows;
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        fields.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Column name mapping from common CSV headers to our field names */
const COLUMN_MAP: Record<string, string> = {
  // firstName variants
  firstname: "firstName",
  first: "firstName",
  "first name": "firstName",
  fname: "firstName",

  // lastName variants
  lastname: "lastName",
  last: "lastName",
  "last name": "lastName",
  lname: "lastName",

  // email variants
  email: "email",
  emailaddress: "email",
  "email address": "email",

  // dateOfBirth variants
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  birthdate: "dateOfBirth",
  birthday: "dateOfBirth",
  "date of birth": "dateOfBirth",

  // isVeteranDisabled variants
  isveterandisabled: "isVeteranDisabled",
  veteran: "isVeteranDisabled",
  veterandisabled: "isVeteranDisabled",
  "veteran disabled": "isVeteranDisabled",
  "is veteran": "isVeteranDisabled",
  disabled: "isVeteranDisabled",

  // address variants
  addressline1: "addressLine1",
  address: "addressLine1",
  address1: "addressLine1",
  "address line 1": "addressLine1",
  street: "addressLine1",
  streetaddress: "addressLine1",

  addressline2: "addressLine2",
  address2: "addressLine2",
  "address line 2": "addressLine2",
  unit: "addressLine2",
  apt: "addressLine2",
  suite: "addressLine2",

  // city, state, zip
  city: "city",
  town: "city",

  state: "state",
  st: "state",

  zip: "zip",
  zipcode: "zip",
  postalcode: "zip",
  postal: "zip",
  "zip code": "zip",

  // phone
  phone: "phone",
  phonenumber: "phone",
  "phone number": "phone",
  telephone: "phone",
  cell: "phone",
  mobile: "phone",

  // driverLicenseState variants
  driverlicensestate: "driverLicenseState",
  dlstate: "driverLicenseState",
  licensestate: "driverLicenseState",
  "dl state": "driverLicenseState",
  "license state": "driverLicenseState",
  "driver license state": "driverLicenseState",

  // emergencyContactName variants
  emergencycontactname: "emergencyContactName",
  emergencyname: "emergencyContactName",
  "emergency contact name": "emergencyContactName",
  "emergency name": "emergencyContactName",
  "emergency contact": "emergencyContactName",
  ecname: "emergencyContactName",

  // emergencyContactPhone variants
  emergencycontactphone: "emergencyContactPhone",
  emergencyphone: "emergencyContactPhone",
  "emergency contact phone": "emergencyContactPhone",
  "emergency phone": "emergencyContactPhone",
  ecphone: "emergencyContactPhone",

  // emergencyContactRelationship variants
  emergencycontactrelationship: "emergencyContactRelationship",
  emergencyrelationship: "emergencyContactRelationship",
  "emergency contact relationship": "emergencyContactRelationship",
  "emergency relationship": "emergencyContactRelationship",
  relationship: "emergencyContactRelationship",
  ecrelationship: "emergencyContactRelationship",
};

function mapColumnName(rawHeader: string): string | null {
  const normalized = rawHeader.toLowerCase().replace(/[\s_]+/g, "");
  return COLUMN_MAP[normalized] ?? null;
}

/**
 * Validate the CSV headers and return the mapping.
 * Returns an error if required columns are missing.
 */
function validateHeaders(
  rawHeaders: string[]
): { mapping: Record<string, string>; errors: string[] } {
  const mapping: Record<string, string> = {};
  const errors: string[] = [];

  for (const raw of rawHeaders) {
    const normalized = raw.trim().toLowerCase().replace(/[\s_]+/g, "");
    const mapped = mapColumnName(normalized);
    if (mapped) {
      mapping[normalized] = mapped;
    }
  }

  const requiredFields = [
    "firstName",
    "lastName",
    "email",
    "dateOfBirth",
    "addressLine1",
    "city",
    "state",
    "zip",
  ];

  const mappedValues = Object.values(mapping);
  for (const field of requiredFields) {
    if (!mappedValues.includes(field)) {
      errors.push(`Missing required column: ${field}`);
    }
  }

  return { mapping, errors };
}

/**
 * Import members from CSV text into a selected membership year.
 *
 * For each row:
 * 1. Checks if a household with the same email exists; reuses it or creates a new one
 * 2. Checks if a primary member with the same email exists; skips if already present
 * 3. Creates household + primary member
 * 4. Enrolls into the selected membership year with ACTIVE status
 * 5. Calculates pricing (veteran/senior discounts)
 *
 * This is designed for importing historical/existing members who are already paid up.
 * Members are created as ACTIVE (not NEW_PENDING).
 */
export async function importMembers(
  csvText: string,
  membershipYearId: string
): Promise<ActionResult<ImportResult>> {
  try {
    const { adminMember } = await getAdminSession();

    // Validate membership year exists
    const yearRecord = await db
      .select()
      .from(membershipYear)
      .where(eq(membershipYear.id, membershipYearId))
      .limit(1);

    if (!yearRecord[0]) {
      return { success: false, error: "Membership year not found" };
    }

    // Parse CSV
    const rawRows = parseCSV(csvText);
    if (rawRows.length === 0) {
      return {
        success: false,
        error: "CSV file is empty or has no data rows",
      };
    }

    // Validate headers — get the header row from csv text
    const firstLine = csvText.split(/\r?\n/)[0];
    const rawHeaders = parseCSVLine(firstLine);
    const { mapping, errors: headerErrors } = validateHeaders(rawHeaders);

    if (headerErrors.length > 0) {
      return {
        success: false,
        error: `Invalid CSV headers: ${headerErrors.join(", ")}`,
      };
    }

    // Map raw row keys to our field names
    const rows = rawRows.map((rawRow) => {
      const mapped: Record<string, string> = {};
      for (const [rawKey, value] of Object.entries(rawRow)) {
        const fieldName = mapping[rawKey];
        if (fieldName) {
          mapped[fieldName] = value;
        }
      }
      return mapped;
    });

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    // Check capacity before starting (non-locking for display/pre-check)
    const capacity = await getCapacityDisplay(
      membershipYearId,
      yearRecord[0].capacityCap
    );

    if (capacity.available < rows.length) {
      return {
        success: false,
        error: `Not enough capacity. Available: ${capacity.available}, Rows to import: ${rows.length}. Current occupancy: ${capacity.occupied}/${capacity.cap}.`,
      };
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      try {
        // Parse boolean for isVeteranDisabled
        const isVetStr = (row.isVeteranDisabled ?? "").toLowerCase();
        const isVeteranDisabled =
          isVetStr === "true" || isVetStr === "yes" || isVetStr === "1";

        // Validate row data
        const parsed = importRowSchema.safeParse({
          firstName: row.firstName ?? "",
          lastName: row.lastName ?? "",
          email: row.email ?? "",
          dateOfBirth: row.dateOfBirth ?? "",
          isVeteranDisabled,
          addressLine1: row.addressLine1 ?? "",
          addressLine2: row.addressLine2 || undefined,
          city: row.city ?? "",
          state: (row.state ?? "KY").toUpperCase(),
          zip: row.zip ?? "",
          phone: row.phone || undefined,
          driverLicenseState: row.driverLicenseState
            ? row.driverLicenseState.toUpperCase()
            : undefined,
          emergencyContactName: row.emergencyContactName || undefined,
          emergencyContactPhone: row.emergencyContactPhone || undefined,
          emergencyContactRelationship:
            row.emergencyContactRelationship || undefined,
        });

        if (!parsed.success) {
          const issues = parsed.error.issues;
          for (const issue of issues) {
            result.errors.push({
              row: rowNum,
              field: issue.path.join("."),
              message: issue.message,
              data: row,
            });
          }
          continue;
        }

        const data = parsed.data;

        // Check if household with this email already exists
        const existingHousehold = await db
          .select()
          .from(household)
          .where(eq(household.email, data.email))
          .limit(1);

        let householdId: string;

        if (existingHousehold[0]) {
          householdId = existingHousehold[0].id;

          // Check if this household already has a membership for this year
          const existingMembership = await db
            .select()
            .from(membership)
            .where(
              and(
                eq(membership.householdId, householdId),
                eq(membership.membershipYearId, membershipYearId)
              )
            )
            .limit(1);

          if (existingMembership[0]) {
            result.skipped++;
            result.errors.push({
              row: rowNum,
              message: `Skipped: household "${data.email}" already has a membership for this year`,
              data: row,
            });
            continue;
          }

          // Check if a primary member with this email exists
          const existingMember = await db
            .select()
            .from(member)
            .where(eq(member.email, data.email))
            .limit(1);

          if (!existingMember[0]) {
            // Household exists but no member — create the primary member
            await db.insert(member).values({
              householdId,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              dateOfBirth: data.dateOfBirth,
              role: "PRIMARY",
              isVeteranDisabled: data.isVeteranDisabled,
              driverLicenseState: data.driverLicenseState,
              emergencyContactName: data.emergencyContactName,
              emergencyContactPhone: data.emergencyContactPhone,
              emergencyContactRelationship: data.emergencyContactRelationship,
            });
          }
        } else {
          // Create new household
          const [createdHousehold] = await db
            .insert(household)
            .values({
              name: `${data.lastName} Household`,
              email: data.email,
              addressLine1: data.addressLine1,
              addressLine2: data.addressLine2,
              city: data.city,
              state: data.state,
              zip: data.zip,
              phone: data.phone,
            })
            .returning({ id: household.id });

          householdId = createdHousehold.id;

          // Create primary member
          await db.insert(member).values({
            householdId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            dateOfBirth: data.dateOfBirth,
            role: "PRIMARY",
            isVeteranDisabled: data.isVeteranDisabled,
            driverLicenseState: data.driverLicenseState,
            emergencyContactName: data.emergencyContactName,
            emergencyContactPhone: data.emergencyContactPhone,
            emergencyContactRelationship: data.emergencyContactRelationship,
          });
        }

        // Calculate pricing
        const pricing = calculatePrice({
          dateOfBirth: data.dateOfBirth,
          isVeteranDisabled: data.isVeteranDisabled,
          membershipYear: yearRecord[0].year,
        });

        // Create ACTIVE membership
        await db.insert(membership).values({
          householdId,
          membershipYearId,
          status: "ACTIVE",
          priceCents: pricing.priceCents,
          discountType: pricing.discountType,
          enrolledAt: new Date(),
        });

        result.imported++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        // Handle unique constraint violations gracefully
        if (message.includes("unique") || message.includes("duplicate")) {
          result.skipped++;
          result.errors.push({
            row: rowNum,
            message: `Skipped: duplicate entry (${message})`,
            data: row,
          });
        } else {
          result.errors.push({
            row: rowNum,
            message,
            data: row,
          });
        }
      }
    }

    // Audit log the import
    await recordAudit({
      actorId: adminMember.id,
      actorType: "ADMIN",
      action: "members.import",
      entityType: "membership_year",
      entityId: membershipYearId,
      metadata: {
        year: yearRecord[0].year,
        totalRows: rows.length,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      },
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get a CSV template string with the expected headers.
 */
export async function getImportTemplate(): Promise<string> {
  await getAdminSession();
  return "firstName,lastName,email,dateOfBirth,isVeteranDisabled,addressLine1,addressLine2,city,state,zip,phone,driverLicenseState,emergencyContactName,emergencyContactPhone,emergencyContactRelationship\nJohn,Doe,john@example.com,1985-05-15,false,123 Main St,,Mt Sterling,KY,40353,859-555-1234,KY,Jane Doe,859-555-5678,Spouse";
}
