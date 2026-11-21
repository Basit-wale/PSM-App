import { z } from "zod";

export const saleSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  customerId: z.string().uuid("Invalid customer.").optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        type: z.enum(["PRODUCT", "SERVICE"]),
        itemId: z.string().uuid("Invalid item."),
        assignedMemberId: z.string().uuid("Select a valid staff member."),
        quantity: z
          .string()
          .regex(/^\d+(\.\d{1,3})?$/, "Enter a valid quantity.")
          .refine(
            (value) => Number(value) > 0,
            "Quantity must be greater than zero.",
          ),
      }),
    )
    .min(1, "Add at least one item.")
    .max(100, "A sale cannot contain more than 100 items."),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CARD",
    "MOBILE_MONEY",
    "OTHER",
  ]),
  discount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid discount.")
    .default("0"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type SaleInput = z.infer<typeof saleSchema>;
