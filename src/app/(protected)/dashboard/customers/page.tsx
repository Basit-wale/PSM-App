import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { CustomerManager } from "@/components/customers/customer-manager";

export const instant = false;

export default async function CustomersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    include: {
      branches: {
        where: {
          branch: { status: "ACTIVE" },
        },
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!membership) redirect("/setup");

  await requirePermission(membership.organizationId, "customers:read");

  const isOrganizationWide =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const assignedBranchIds = membership.branches.map((item) => item.branchId);

  const [branches, customers] = await Promise.all([
    db.branch.findMany({
      where: {
        organizationId: membership.organizationId,
        status: "ACTIVE",
        ...(isOrganizationWide ? {} : { id: { in: assignedBranchIds } }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),

    db.customer.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(isOrganizationWide
          ? {}
          : {
              branches: {
                some: {
                  branchId: { in: assignedBranchIds },
                },
              },
            }),
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        whatsappOptIn: true,
        smsOptIn: true,
        createdAt: true,
        dateOfBirth: true,
        notes: true,
        branches: {
          select: {
            branchId: true,
            branch: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return (
    <CustomerManager
      customers={customers}
      branches={branches}
      canManageCustomers={hasPermission(membership.role, "customers:manage")}
      canManageSms={hasPermission(membership.role, "campaigns:manage")}
      organizationWide={isOrganizationWide}
    />
  );
}
