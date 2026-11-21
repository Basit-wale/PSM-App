import { z } from "zod";

export const serviceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must contain at least 2 characters.")
    .max(100, "Category name is too long."),
  description: z
    .string()
    .trim()
    .max(1000, "Description is too long.")
    .optional()
    .or(z.literal("")),
});

export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;
