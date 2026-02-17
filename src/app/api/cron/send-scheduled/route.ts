import { NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { runSendScheduled } from "@/lib/utils/send-scheduled";

export async function POST(request: Request) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  try {
    const result = await runSendScheduled();
    console.log(
      `[cron] Send-scheduled complete: ${result.sent} sent, ${result.failed} failed`
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[cron] Send-scheduled failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
