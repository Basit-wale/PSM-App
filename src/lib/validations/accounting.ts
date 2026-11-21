import { z } from "zod";

export const createLedgerAccountSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(100),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export const createJournalEntrySchema = z.object({
  branchId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(2).max(500),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
  entryDate: z.string().min(1, "Select an entry date."),
  lines: z
    .array(
      z.object({
        accountId: z.string().uuid("Select a valid account."),
        description: z.string().trim().max(200).optional().or(z.literal("")),
        debit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid debit."),
        credit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid credit."),
      }),
    )
    .min(2, "A journal entry needs at least two lines."),
});

export type CreateLedgerAccountInput = z.infer<
  typeof createLedgerAccountSchema
>;

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
