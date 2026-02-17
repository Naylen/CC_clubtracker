import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { lapseCheck } from "@/lib/inngest/functions/lapse-check";
import { emailBatch } from "@/lib/inngest/functions/email-batch";
import { seedRenewals } from "@/lib/inngest/functions/seed-renewals";
import { dbBackup } from "@/lib/inngest/functions/db-backup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [lapseCheck, emailBatch, seedRenewals, dbBackup],
});
