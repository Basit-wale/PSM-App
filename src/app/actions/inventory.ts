"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireBranchPermission } from "@/lib/auth-guard";
import { setStockSchema } from "@/lib/validations/inventory";

type ActionResult = { success: true } | { success: false; error: string };

export async function setBranchStock(input: unknown): Promise<ActionResult> {
  const parsed = setStockSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid stock details.",
    };
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "Please sign in again." };
    }

    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        organizationId: true,
        id: true,
      },
    });

    if (!member) {
      return { success: false, error: "No active organization found." };
    }

    const { branchId, productId, quantity, reason } = parsed.data;

    await requireBranchPermission(
      member.organizationId,
      branchId,
      "inventory:manage",
    );

    const result = await db.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: {
          id: productId,
          organizationId: member.organizationId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!product) {
        throw new Error("Product not found or inactive.");
      }

      const requestedQuantity = Number(quantity);

      const existing = await tx.inventoryBalance.findUnique({
        where: {
          branchId_productId: {
            branchId,
            productId,
          },
        },
        select: {
          id: true,
          quantity: true,
        },
      });

      const previousQuantity = existing ? Number(existing.quantity) : 0;

      const difference = requestedQuantity - previousQuantity;

      if (difference === 0 && existing) {
        return { changed: false };
      }

      await tx.inventoryBalance.upsert({
        where: {
          branchId_productId: {
            branchId,
            productId,
          },
        },
        create: {
          organizationId: member.organizationId,
          branchId,
          productId,
          quantity: requestedQuantity,
        },
        update: {
          quantity: requestedQuantity,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          organizationId: member.organizationId,
          branchId,
          productId,
          type: existing ? "ADJUSTMENT" : "OPENING",
          quantity: difference,
          reason:
            reason || (existing ? "Manual stock adjustment" : "Opening stock"),
        },
      });

      return { changed: true };
    });

    return { success: true };
  } catch (error) {
    console.error("setBranchStock error:", error);

    if (error instanceof Error) {
      if (error.message.includes("permission")) {
        return {
          success: false,
          error: "You do not have permission to manage inventory.",
        };
      }

      if (
        error.message.includes("branch") ||
        error.message.includes("access")
      ) {
        return {
          success: false,
          error: "You do not have access to this branch.",
        };
      }

      if (error.message.includes("Product not found")) {
        return { success: false, error: error.message };
      }

      if (error.message.includes("Authentication")) {
        return { success: false, error: "Please sign in again." };
      }
    }

    return {
      success: false,
      error: "Unable to update stock. Please try again.",
    };
  }
}

type DailyActivityInput = {
  branchId: string;
  startAt: string;
  endAt: string;
};

export async function getDailyActivity(input: DailyActivityInput) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false as const,
        error: "Please sign in again.",
      };
    }

    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        organizationId: true,
      },
    });

    if (!member) {
      return {
        success: false as const,
        error: "No active organization found.",
      };
    }

    const { branchId, startAt, endAt } = input;

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        branchId,
      ) ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      return {
        success: false as const,
        error: "Invalid branch or date range.",
      };
    }

    await requireBranchPermission(
      member.organizationId,
      branchId,
      "inventory:read",
    );

    const sales = await db.sale.findMany({
      where: {
        organizationId: member.organizationId,
        branchId,
        status: "PAID",
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
        payments: {
          some: {
            status: "COMPLETED",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        receiptNumber: true,
        createdAt: true,
        total: true,
        branch: {
          select: {
            name: true,
          },
        },
        createdBy: {
          select: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            productId: true,
            serviceId: true,
            assignedMemberId: true,
            assignedMemberName: true,
            quantity: true,
            unitPrice: true,
            total: true,
            stockBefore: true,
            stockAfter: true,
          },
        },
        payments: {
          where: {
            status: "COMPLETED",
          },
          select: {
            method: true,
            paidAt: true,
          },
        },
      },
    });

    const rows = sales.flatMap((sale) =>
      sale.items.map((item) => ({
        id: item.id,
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        branchName: sale.branch.name,
        timestamp: sale.createdAt.toISOString(),
        processedBy: sale.createdBy?.user.name ?? "Unknown",
        staffId: item.assignedMemberId,
        staffName: item.assignedMemberName ?? "Staff member",
        itemName: item.description,
        type: item.productId ? "PRODUCT" : "SERVICE",
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        amount: item.total.toString(),
        stockBefore: item.stockBefore?.toString() ?? null,
        stockAfter: item.stockAfter?.toString() ?? null,
        paymentMethod: [
          ...new Set(sale.payments.map((payment) => payment.method)),
        ].join(", "),
      })),
    );

    return {
      success: true as const,
      rows,
    };
  } catch (error) {
    console.error("getDailyActivity error:", error);

    return {
      success: false as const,
      error:
        "Unable to retrieve daily activity. Check your access and try again.",
    };
  }
}
