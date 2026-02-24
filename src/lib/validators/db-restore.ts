import { z } from "zod";

export const restoreBackupSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  fileName: z.string().min(1, "File name is required"),
  confirmationText: z.string().min(1, "Confirmation text is required"),
});

export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
