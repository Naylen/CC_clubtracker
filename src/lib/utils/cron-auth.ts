import { NextResponse } from "next/server";

/**
 * Validate that a cron request has the correct CRON_SECRET header.
 * Returns null if valid, or an error NextResponse if invalid.
 */
export function validateCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET environment variable not set");
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 500 }
    );
  }

  const provided = request.headers.get("x-cron-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
