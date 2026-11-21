
import { z } from "zod";

export const organizationSetupSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Salon name must be at least 2 characters.")
    .max(100, "Salon name cannot exceed 100 characters."),

  branchName: z
    .string()
    .trim()
    .min(2, "Branch name must be at least 2 characters.")
    .max(100, "Branch name cannot exceed 100 characters."),

  branchCode: z
    .string()
    .trim()
    .min(2, "Branch code must be at least 2 characters.")
    .max(20, "Branch code cannot exceed 20 characters.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Branch code can only contain letters, numbers, and hyphens."
    ),

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
});

export type OrganizationSetupInput = z.infer<
  typeof organizationSetupSchema
>;
