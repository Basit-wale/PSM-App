import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { SalesManager } from "@/components/sales/sales-manager";

export const instant = false;

export default async function SalesPage() {
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
      organization: {
        select: {
          defaultTaxRate: true,
        },
      },
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

  try {
    await requirePermission(membership.organizationId, "sales:read");
  } catch {
    return <AccessDenied />;
  }

  const organizationWide =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const assignedBranchIds = membership.branches.map((item) => item.branchId);

  const branchScope = organizationWide ? {} : { id: { in: assignedBranchIds } };

  const [branches, customers, products, services, sales, staff] =
    await Promise.all([
      db.branch.findMany({
        where: {
          organizationId: membership.organizationId,
          status: "ACTIVE",
          ...branchScope,
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
          ...(organizationWide
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
          branches: {
            select: {
              branchId: true,
            },
          },
        },
      }),

      db.product.findMany({
        where: {
          organizationId: membership.organizationId,
          status: "ACTIVE",
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          sellingPrice: true,
        },
      }),

      db.service.findMany({
        where: {
          organizationId: membership.organizationId,
          isActive: true,
          category: { isActive: true },
        },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          durationMins: true,
        },
      }),

      db.sale.findMany({
        where: {
          organizationId: membership.organizationId,
          ...(organizationWide
            ? {}
            : {
                branchId: { in: assignedBranchIds },
              }),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          branch: {
            select: { name: true },
          },
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          items: {
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              total: true,
            },
          },
          payments: {
            select: {
              amount: true,
              method: true,
              status: true,
            },
          },
        },
      }),

      db.organizationMember.findMany({
        where: {
          organizationId: membership.organizationId,
          isActive: true,
          branches: {
            some: {
              branch: { status: "ACTIVE" },
              ...(organizationWide
                ? {}
                : {
                    branchId: { in: assignedBranchIds },
                  }),
            },
          },
        },
        orderBy: {
          user: {
            name: "asc",
          },
        },
        select: {
          id: true,
          user: {
            select: {
              name: true,
            },
          },
          branches: {
            where: {
              branch: { status: "ACTIVE" },
              ...(organizationWide
                ? {}
                : {
                    branchId: { in: assignedBranchIds },
                  }),
            },
            select: {
              branchId: true,
            },
          },
        },
      }),
    ]);

  const branchIds = branches.map((branch) => branch.id);
  const productIds = products.map((product) => product.id);

  const inventory = await db.inventoryBalance.findMany({
    where: {
      organizationId: membership.organizationId,
      branchId: { in: branchIds },
      productId: { in: productIds },
    },
    select: {
      branchId: true,
      productId: true,
      quantity: true,
    },
  });

  const formattedProducts = products.map((product) => ({
    ...product,
    sellingPrice: product.sellingPrice.toString(),
    inventory: inventory
      .filter((item) => item.productId === product.id)
      .map((item) => ({
        branchId: item.branchId,
        quantity: item.quantity.toString(),
      })),
  }));

  const formattedServices = services.map((service) => ({
    ...service,
    price: service.price.toString(),
  }));

  const formattedSales = sales.map((sale) => ({
    ...sale,
    subtotal: sale.subtotal.toString(),
    discount: sale.discount.toString(),
    tax: sale.tax.toString(),
    total: sale.total.toString(),
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      total: item.total.toString(),
    })),
    payments: sale.payments.map((payment) => ({
      ...payment,
      amount: payment.amount.toString(),
    })),
  }));

  const formattedStaff = staff.map((member) => ({
    id: member.id,
    name: member.user.name,
    branchIds: member.branches.map((item) => item.branchId),
  }));

  return (
    <SalesManager
      branches={branches}
      customers={customers}
      products={formattedProducts}
      services={formattedServices}
      sales={formattedSales}
      staff={formattedStaff}
      defaultTaxRate={membership.organization.defaultTaxRate.toString()}
      canCreateSales={
        hasPermission(membership.role, "sales:create") &&
        hasPermission(membership.role, "payments:manage")
      }
    />
  );
}
