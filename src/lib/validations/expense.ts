import { z } from "zod";

export const createExpenseSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  categoryId: z.string().uuid("Select an expense category."),
  description: z
    .string()
    .trim()
    .min(2, "Enter an expense description.")
    .max(500),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount.")
    .refine((value) => Number(value) > 0, "Amount must be greater than zero."),
  vendor: z.string().trim().max(200).optional().or(z.literal("")),
  reference: z.string().trim().max(100).optional().or(z.literal("")),
  expenseDate: z.string().min(1, "Select an expense date."),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
