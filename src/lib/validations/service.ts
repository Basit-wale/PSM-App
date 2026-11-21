import { z } from "zod";

export const serviceSchema = z.object({
  categoryId: z.string().uuid("Select a valid service category."),
  name: z
    .string()
    .trim()
    .min(2, "Service name must contain at least 2 characters.")
    .max(100, "Service name is too long."),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  price: z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Enter a valid price with up to 2 decimal places.",
    )
    .refine((value) => Number(value) > 0, "Price must be greater than zero."),
  durationMins: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+$/.test(value) && Number(value) >= 5 && Number(value) <= 1440),
      "Duration must be between 5 and 1440 minutes.",
    ),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
