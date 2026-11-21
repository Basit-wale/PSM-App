import { z } from "zod";

export const updateOrganizationSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters.")
    .max(100),

  currency: z.enum([
    "NGN",
    "USD",
    "GBP",
    "EUR",
    "GHS",
    "KES",
    "ZAR",
    "CAD",
    "AUD",
  ]),

  timezone: z.string().trim().min(1, "Select a time zone.").max(100),

  defaultTaxRate: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid tax rate.")
    .refine(
      (value) => Number(value) >= 0 && Number(value) <= 100,
      "Tax rate must be between 0 and 100.",
    ),
});

export type UpdateOrganizationSettingsInput = z.infer<
  typeof updateOrganizationSettingsSchema
>;
