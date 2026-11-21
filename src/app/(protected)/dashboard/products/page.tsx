import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { ProductManager } from "@/components/products/product-manager";

export const instant = false;

export default async function ProductsPage() {
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

  if (!member) redirect("/login");

  try {
    await requirePermission(member.organizationId, "products:read");
  } catch {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You do not have permission to view products.
        </p>
      </div>
    );
  }

  const products = await db.product.findMany({
    where: {
      organizationId: member.organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      sku: true,
      description: true,
      costPrice: true,
      sellingPrice: true,
      status: true,
      createdAt: true,
    },
  });

  const formattedProducts = products.map((product) => ({
    ...product,
    costPrice: product.costPrice.toString(),
    sellingPrice: product.sellingPrice.toString(),
  }));

  return (
    <ProductManager
      products={formattedProducts}
      canManageProducts={
        member.role === "OWNER" ||
        member.role === "ADMIN" ||
        member.role === "BRANCH_MANAGER" ||
        member.role === "INVENTORY_MANAGER"
      }
    />
  );
}
