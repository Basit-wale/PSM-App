import { z } from "zod";

export const createCustomerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must contain at least 2 characters.")
    .max(80, "First name is too long."),

  lastName: z
    .string()
    .trim()
    .max(80, "Last name is too long.")
    .optional()
    .or(z.literal("")),

  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(20, "Phone number is too long.")
    .regex(/^[+0-9()\s-]+$/, "Enter a valid phone number."),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email address is too long.")
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email address.",
    ),

  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => {
      if (!value) return true;

      const date = new Date(`${value}T00:00:00.000Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value &&
        date <= new Date()
      );
    }, "Enter a valid date of birth."),

  whatsappOptIn: z.boolean().default(false),
  smsOptIn: z.boolean().default(false),

  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2,000 characters.")
    .optional()
    .or(z.literal("")),
});

export const updateCustomerSchema = createCustomerSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
