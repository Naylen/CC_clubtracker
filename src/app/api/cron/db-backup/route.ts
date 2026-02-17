import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { runDbBackup } from "@/lib/utils/db-backup";

export async function POST(request: Request) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  try {
    const result = await runDbBackup();
    console.log(
      `[cron] DB backup complete: ${result.filename} (${result.sizeBytes} bytes)`
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[cron] DB backup failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
