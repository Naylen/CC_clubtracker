import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { runLapseCheck } from "@/lib/utils/lapse-check";

export async function POST(request: Request) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  try {
    const result = await runLapseCheck();
    console.log(`[cron] Lapse check complete: ${result.lapsedCount} lapsed`);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[cron] Lapse check failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
