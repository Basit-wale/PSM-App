import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { InventoryManager } from "@/components/inventory/inventory-manager";

export const instant = false;

export default async function InventoryPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
      role: true,
    },
  });

  if (!member) redirect("/setup");

  let context;

  try {
    context = await requirePermission(member.organizationId, "inventory:read");
  } catch {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You do not have permission to view inventory.
        </p>
      </div>
    );
  }

  const isOrganizationAdmin =
    context.role === MemberRole.OWNER || context.role === MemberRole.ADMIN;

  const branches = await db.branch.findMany({
    where: isOrganizationAdmin
      ? {
          organizationId: member.organizationId,
          status: "ACTIVE",
        }
      : {
          organizationId: member.organizationId,
          status: "ACTIVE",
          id: { in: context.branchIds },
        },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  const products = await db.product.findMany({
    where: {
      organizationId: member.organizationId,
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
    },
  });

  const balances = await db.inventoryBalance.findMany({
    where: {
      organizationId: member.organizationId,
      branchId: { in: branches.map((branch) => branch.id) },
    },
    include: {
      product: {
        select: {
          name: true,
          sku: true,
        },
      },
      branch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const formattedBalances = balances.map((balance) => ({
    id: balance.id,
    branchId: balance.branchId,
    branchName: balance.branch.name,
    productId: balance.productId,
    productName: balance.product.name,
    sku: balance.product.sku,
    quantity: balance.quantity.toString(),
    updatedAt: balance.updatedAt.toISOString(),
  }));

  return (
    <InventoryManager
      branches={branches}
      products={products}
      balances={formattedBalances}
      canManageInventory={context.role === MemberRole.OWNER}
    />
  );
}
