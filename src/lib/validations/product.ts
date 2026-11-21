import { z } from "zod";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must contain at least 2 characters.")
    .max(120, "Product name is too long."),

  sku: z
    .string()
    .trim()
    .min(2, "SKU must contain at least 2 characters.")
    .max(50, "SKU is too long.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "SKU can only contain letters, numbers, hyphens and underscores.",
    ),

  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1,000 characters.")
    .optional()
    .or(z.literal("")),

  costPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid cost price.")
    .refine((value) => Number(value) >= 0, "Cost price cannot be negative."),

  sellingPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid selling price.")
    .refine(
      (value) => Number(value) > 0,
      "Selling price must be greater than zero.",
    ),
});

export type ProductInput = z.infer<typeof productSchema>;
