import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, AuthorizationError } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { AppointmentManager } from "@/components/appointments/appointment-manager";

export const instant = false;

export default async function AppointmentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: { organizationId: true },
  });

  if (!membership) redirect("/setup");

  let context;

  try {
    context = await requirePermission(
      membership.organizationId,
      "appointments:read",
    );
  } catch (error) {
    if (error instanceof AuthorizationError && error.statusCode === 403) {
      return <AccessDenied />;
    }
    throw error;
  }

  const organizationId = membership.organizationId;
  const organizationWide = context.role === "OWNER" || context.role === "ADMIN";

  const branches = await db.branch.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      ...(organizationWide ? {} : { id: { in: context.branchIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });

  const accessibleBranchIds = branches.map((branch) => branch.id);

  const [customers, services, staff, appointments] = await Promise.all([
    db.customer.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        branches: {
          some: {
            branchId: { in: accessibleBranchIds },
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        branches: {
          select: { branchId: true },
        },
      },
    }),

    db.service.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        durationMins: true,
      },
    }),

    db.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        branches: {
          some: {
            branchId: { in: accessibleBranchIds },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { name: true } },
        branches: { select: { branchId: true } },
      },
    }),

    db.appointment.findMany({
      where: {
        organizationId,
        ...(organizationWide ? {} : { branchId: { in: accessibleBranchIds } }),
      },
      orderBy: { startsAt: "desc" },
      take: 200,
      select: {
        id: true,
        branchId: true,
        customerId: true,
        assignedMemberId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        notes: true,
        branch: { select: { name: true } },
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        assignedMember: {
          select: {
            user: { select: { name: true } },
          },
        },
        items: {
          select: {
            id: true,
            serviceId: true,
            serviceName: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            durationMins: true,
          },
        },
      },
    }),
  ]);

  return (
    <AppointmentManager
      branches={branches}
      customers={customers}
      services={services.map((service) => ({
        ...service,
        price: service.price.toString(),
      }))}
      staff={staff.map((member) => ({
        id: member.id,
        name: member.user.name,
        role: member.role,
        branchIds: member.branches.map((item) => item.branchId),
      }))}
      appointments={appointments.map((appointment) => ({
        ...appointment,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        items: appointment.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString(),
        })),
        staffName: appointment.assignedMember?.user.name ?? null,
        customerName:
          `${appointment.customer.firstName} ${appointment.customer.lastName ?? ""}`.trim(),
        customerPhone: appointment.customer.phone,
      }))}
      canManageAppointments={hasPermission(context.role, "appointments:manage")}
    />
  );
}
