import { z } from "zod";

const branchFields = {
  name: z
    .string()
    .trim()
    .min(2, "Branch name must be at least 2 characters.")
    .max(100, "Branch name cannot exceed 100 characters."),

  code: z
    .string()
    .trim()
    .min(2, "Branch code must be at least 2 characters.")
    .max(20, "Branch code cannot exceed 20 characters.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Branch code can only contain letters, numbers, and hyphens.",
    )
    .transform((value) => value.toUpperCase()),

  address: z
    .string()
    .trim()
    .max(255, "Address cannot exceed 255 characters.")
    .optional(),

  phone: z
    .string()
    .trim()
    .max(30, "Phone number cannot exceed 30 characters.")
    .optional(),

  email: z
    .string()
    .trim()
    .max(254, "Email cannot exceed 254 characters.")
    .pipe(z.union([z.literal(""), z.email()]))
    .optional(),
};

export const createBranchSchema = z.object(branchFields);

export const updateBranchSchema = z.object({
  id: z.string().uuid("Invalid branch ID."),
  ...branchFields,
});

export const branchIdSchema = z.object({
  id: z.string().uuid("Invalid branch ID."),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const branchStatusSchema = z.object({
  id: z.string().uuid("Invalid branch ID."),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
