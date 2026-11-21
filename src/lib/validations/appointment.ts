import { z } from "zod";

export const appointmentSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  customerId: z.string().uuid("Select a customer."),
  assignedMemberId: z
    .string()
    .uuid("Select a valid staff member.")
    .optional()
    .or(z.literal("")),
  startsAt: z.string().datetime("Enter a valid appointment date and time."),
  serviceIds: z
    .array(z.string().uuid("Invalid service selected."))
    .min(1, "Select at least one service.")
    .max(20, "You can select up to 20 services."),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2,000 characters.")
    .optional()
    .or(z.literal("")),
});

export const updateAppointmentStatusSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment."),
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;
