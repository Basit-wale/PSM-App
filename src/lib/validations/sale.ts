import { z } from "zod";

const saleItemSchema = z
  .object({
    type: z.enum(["PRODUCT", "SERVICE"]),
    itemId: z.string().uuid("Invalid item."),
    assignedMemberId: z
      .string()
      .uuid("Select a valid staff member.")
      .nullable()
      .optional(),
    assignedBranchStaffId: z
      .string()
      .uuid("Select a valid staff member.")
      .nullable()
      .optional(),
    negotiatedPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid negotiated price.")
      .refine(
        (value) => Number(value) > 0,
        "Negotiated price must be greater than zero.",
      )
      .optional(),
    quantity: z
      .string()
      .regex(/^\d+(\.\d{1,3})?$/, "Enter a valid quantity.")
      .refine(
        (value) => Number(value) > 0,
        "Quantity must be greater than zero.",
      ),
  })
  .superRefine((item, ctx) => {
    const hasMember = Boolean(item.assignedMemberId);
    const hasBranchStaff = Boolean(item.assignedBranchStaffId);

    if (item.type === "SERVICE" && hasMember === hasBranchStaff) {
      ctx.addIssue({
        code: "custom",
        message: "Assign exactly one staff member to each service.",
        path: ["assignedMemberId"],
      });
    }

    if (item.type === "PRODUCT" && (hasMember || hasBranchStaff)) {
      ctx.addIssue({
        code: "custom",
        message: "Product sales must not have a staff assignment.",
        path: ["assignedMemberId"],
      });
    }
  });

export const saleSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  customerId: z.string().uuid("Invalid customer.").optional().or(z.literal("")),
  items: z
    .array(saleItemSchema)
    .min(1, "Add at least one item.")
    .max(100, "A sale cannot contain more than 100 items."),
  payments: z
    .array(
      z.object({
        method: z.enum([
          "CASH",
          "BANK_TRANSFER",
          "CARD",
          "MOBILE_MONEY",
          "OTHER",
        ]),
        amount: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid payment amount.")
          .refine(
            (value) => Number(value) > 0,
            "Payment amount must be greater than zero.",
          ),
      }),
    )
    .min(1, "Add at least one payment method.")
    .max(10, "A sale cannot have more than 10 payment entries."),
  discount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid discount.")
    .default("0"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type SaleInput = z.infer<typeof saleSchema>;
