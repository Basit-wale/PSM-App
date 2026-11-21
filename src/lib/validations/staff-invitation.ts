import { z } from "zod";

export const createStaffInvitationSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .max(254, "Email address is too long."),

    role: z.enum([
      "ADMIN",
      "BRANCH_MANAGER",
      "ACCOUNTANT",
      "INVENTORY_MANAGER",
      "RECEPTIONIST",
      "CRM_MANAGER",
    ]),

    branchIds: z
      .array(z.string().uuid("Invalid branch ID."))
      .max(20, "You cannot assign more than 20 branches.")
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "ADMIN" && data.branchIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["branchIds"],
        message: "Select at least one branch for this staff member.",
      });
    }

    if (new Set(data.branchIds).size !== data.branchIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["branchIds"],
        message: "A branch cannot be selected more than once.",
      });
    }
  });

export type CreateStaffInvitationInput = z.infer<
  typeof createStaffInvitationSchema
>;
