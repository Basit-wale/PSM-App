"use server";

import { headers } from "next/headers";
import { AppointmentStatus } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireBranchPermission } from "@/lib/auth-guard";
import {
  appointmentSchema,
  updateAppointmentStatusSchema,
} from "@/lib/validations/appointment";

type ActionResult =
  { success: true; appointmentId?: string } | { success: false; error: string };

async function getAppointmentContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("AUTH_REQUIRED");

  const member = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: { organizationId: true },
  });

  if (!member) throw new Error("ORGANIZATION_ACCESS_REQUIRED");

  return member.organizationId;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      ORGANIZATION_ACCESS_REQUIRED:
        "You do not have active organization access.",
      ACCESS_DENIED: "You do not have permission to manage appointments.",
      RESOURCE_NOT_FOUND: "The selected resource could not be found.",
    };

    if (messages[error.message]) return messages[error.message];

    if (error.message.includes("permission")) {
      return "You do not have permission to manage appointments.";
    }

    if (error.message.includes("Branch not found")) {
      return "The selected branch is unavailable.";
    }
  }

  console.error("Appointment action failed:", error);
  return "The operation could not be completed. Please try again.";
}

async function validateAppointmentResources(
  organizationId: string,
  branchId: string,
  customerId: string,
  assignedMemberId: string | undefined,
  serviceIds: string[],
) {
  const [customer, services, staff] = await Promise.all([
    db.customerBranch.findFirst({
      where: {
        branchId,
        customerId,
        organizationId,
      },
      select: { customerId: true },
    }),
    db.service.findMany({
      where: {
        id: { in: serviceIds },
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        durationMins: true,
      },
    }),
    assignedMemberId
      ? db.branchMembership.findFirst({
          where: {
            branchId,
            organizationId,
            memberId: assignedMemberId,
            member: { isActive: true },
          },
          select: { memberId: true },
        })
      : Promise.resolve(true),
  ]);

  if (!customer) throw new Error("CUSTOMER_NOT_AVAILABLE");
  if (services.length !== serviceIds.length) {
    throw new Error("SERVICE_NOT_AVAILABLE");
  }
  if (!staff) throw new Error("STAFF_NOT_AVAILABLE");

  return services;
}

export async function createAppointment(input: unknown): Promise<ActionResult> {
  try {
    const parsed = appointmentSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.issues[0]?.message ?? "Invalid appointment details.",
      };
    }

    const data = parsed.data;
    const organizationId = await getAppointmentContext();

    await requireBranchPermission(
      organizationId,
      data.branchId,
      "appointments:manage",
    );

    const services = await validateAppointmentResources(
      organizationId,
      data.branchId,
      data.customerId,
      data.assignedMemberId || undefined,
      data.serviceIds,
    );

    const duration = services.reduce(
      (total, service) => total + (service.durationMins ?? 0),
      0,
    );

    if (duration <= 0) {
      return {
        success: false,
        error: "Selected services must have a valid duration.",
      };
    }

    const startsAt = new Date(data.startsAt);

    if (Number.isNaN(startsAt.getTime())) {
      return { success: false, error: "Invalid appointment date." };
    }

    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    const conflict = await db.appointment.findFirst({
      where: {
        organizationId,
        branchId: data.branchId,
        status: {
          notIn: ["CANCELLED", "NO_SHOW"],
        },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(data.assignedMemberId
          ? { assignedMemberId: data.assignedMemberId }
          : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      return {
        success: false,
        error: "The selected time conflicts with another appointment.",
      };
    }

    const appointment = await db.appointment.create({
      data: {
        startsAt,
        endsAt,
        notes: data.notes || null,
        organization: {
          connect: { id: organizationId },
        },
        branch: {
          connect: {
            id_organizationId: {
              id: data.branchId,
              organizationId,
            },
          },
        },
        customer: {
          connect: {
            id_organizationId: {
              id: data.customerId,
              organizationId,
            },
          },
        },
        assignedMember: data.assignedMemberId
          ? {
              connect: {
                id_organizationId: {
                  id: data.assignedMemberId,
                  organizationId,
                },
              },
            }
          : undefined,
        items: {
          create: services.map((service) => ({
            serviceName: service.name,
            quantity: 1,
            unitPrice: service.price,
            lineTotal: service.price,
            durationMins: service.durationMins,
            service: {
              connect: {
                id_organizationId: {
                  id: service.id,
                  organizationId,
                },
              },
            },
          })),
        },
      },
      select: { id: true },
    });

    return { success: true, appointmentId: appointment.id };
  } catch (error) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}

export async function updateAppointmentStatus(
  input: unknown,
): Promise<ActionResult> {
  try {
    const parsed = updateAppointmentStatusSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid status.",
      };
    }

    const organizationId = await getAppointmentContext();

    const appointment = await db.appointment.findFirst({
      where: {
        id: parsed.data.appointmentId,
        organizationId,
      },
      select: { id: true, branchId: true },
    });

    if (!appointment) throw new Error("RESOURCE_NOT_FOUND");

    await requireBranchPermission(
      organizationId,
      appointment.branchId,
      "appointments:manage",
    );

    await db.appointment.update({
      where: { id: appointment.id },
      data: { status: parsed.data.status as AppointmentStatus },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: getSafeErrorMessage(error) };
  }
}
