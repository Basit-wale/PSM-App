import { z } from "zod";

export const setStockSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  productId: z.string().uuid("Select a valid product."),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/, "Enter a valid quantity.")
    .refine(
      (value) => Number(value) >= 0,
      "Stock quantity cannot be negative.",
    ),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export type SetStockInput = z.infer<typeof setStockSchema>;
