"use server";

import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireBranchPermission } from "@/lib/auth-guard";
import { saleSchema } from "@/lib/validations/sale";

type ActionResult =
  | {
      success: true;
      saleId: string;
      receiptNumber: string;
    }
  | {
      success: false;
      error: string;
    };

async function getSaleContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }

  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
    },
  });

  if (!member) {
    throw new Error("ORGANIZATION_ACCESS_REQUIRED");
  }

  return member;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      ORGANIZATION_ACCESS_REQUIRED:
        "You do not have active organization access.",
      "You do not have permission to perform this action.":
        "You do not have permission to process sales or payments.",
      "Branch not found or inactive.": "The selected branch is unavailable.",
      "You do not have access to this branch.":
        "You do not have access to the selected branch.",
      CUSTOMER_NOT_FOUND: "The selected customer is not linked to this branch.",
      PRODUCT_NOT_AVAILABLE: "One or more products are unavailable.",
      SERVICE_NOT_AVAILABLE: "One or more services are unavailable.",
      STAFF_NOT_AVAILABLE:
        "One or more selected staff members are unavailable for this branch.",
      INSUFFICIENT_STOCK:
        "There is insufficient stock for one or more products.",
      INVALID_DISCOUNT: "Discount cannot exceed the subtotal.",
      INVALID_TOTAL: "The sale total must be greater than zero.",
      PRICE_NEGOTIATION_NOT_ALLOWED:
        "You do not have permission to negotiate POS prices.",
    };

    if (messages[error.message]) {
      return messages[error.message];
    }
  }

  console.error("Sale action failed:", error);

  return "The sale could not be completed. Please try again.";
}

export async function createSale(input: unknown): Promise<ActionResult> {
  const parsed = saleSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid sale details.",
    };
  }

  try {
    const member = await getSaleContext();
    const data = parsed.data;

    const canNegotiatePrices =
      member.role === "OWNER" ||
      member.role === "ADMIN" ||
      member.role === "BRANCH_MANAGER";

    if (
      !canNegotiatePrices &&
      data.items.some((item) => item.negotiatedPrice !== undefined)
    ) {
      throw new Error("PRICE_NEGOTIATION_NOT_ALLOWED");
    }

    await requireBranchPermission(
      member.organizationId,
      data.branchId,
      "sales:create",
    );

    await requireBranchPermission(
      member.organizationId,
      data.branchId,
      "payments:manage",
    );

    // Keep each cart line separate so different staff members
    // can receive attribution for the same product or service.
    const items = data.items.map((item) => ({
      type: item.type,
      itemId: item.itemId,
      assignedMemberId: item.assignedMemberId ?? null,
      assignedBranchStaffId: item.assignedBranchStaffId ?? null,
      quantity: new Prisma.Decimal(item.quantity),
      negotiatedPrice: item.negotiatedPrice
        ? new Prisma.Decimal(item.negotiatedPrice)
        : undefined,
    }));

    const discount = new Prisma.Decimal(data.discount || "0");

    if (discount.isNegative()) {
      throw new Error("Invalid sale amounts.");
    }

    const receiptNumber = `SAL-${Date.now()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    return await db.$transaction(
      async (tx) => {
        // Read the organization's saved tax rate.
        const organization = await tx.organization.findUnique({
          where: {
            id: member.organizationId,
          },
          select: {
            defaultTaxRate: true,
          },
        });

        if (!organization) {
          throw new Error("ORGANIZATION_ACCESS_REQUIRED");
        }

        // Validate customer branch membership.
        if (data.customerId) {
          const customer = await tx.customerBranch.findFirst({
            where: {
              customerId: data.customerId,
              branchId: data.branchId,
              organizationId: member.organizationId,
            },
            select: {
              id: true,
            },
          });

          if (!customer) {
            throw new Error("CUSTOMER_NOT_FOUND");
          }
        }

        // Get unique product and service IDs.
        const productIds = [
          ...new Set(
            items
              .filter((item) => item.type === "PRODUCT")
              .map((item) => item.itemId),
          ),
        ];

        const serviceIds = [
          ...new Set(
            items
              .filter((item) => item.type === "SERVICE")
              .map((item) => item.itemId),
          ),
        ];
        // Get unique staff IDs from SERVICE items only.
        // Products must never be attributed to staff.
        const serviceItems = items.filter((item) => item.type === "SERVICE");

        const staffIds = [
          ...new Set(
            serviceItems
              .map((item) => item.assignedMemberId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const branchStaffIds = [
          ...new Set(
            serviceItems
              .map((item) => item.assignedBranchStaffId)
              .filter((id): id is string => Boolean(id)),
          ),
        ];

        const [products, services, staff, regularStaff] = await Promise.all([
          tx.product.findMany({
            where: {
              id: { in: productIds },
              organizationId: member.organizationId,
              status: "ACTIVE",
            },
            select: {
              id: true,
              name: true,
              sellingPrice: true,
            },
          }),

          tx.service.findMany({
            where: {
              id: { in: serviceIds },
              organizationId: member.organizationId,
              isActive: true,
              category: {
                isActive: true,
              },
            },
            select: {
              id: true,
              name: true,
              price: true,
            },
          }),

          tx.organizationMember.findMany({
            where: {
              id: { in: staffIds },
              organizationId: member.organizationId,
              isActive: true,
              branches: {
                some: {
                  branchId: data.branchId,
                },
              },
            },
            select: {
              id: true,
              userId: true,
            },
          }),

          tx.branchStaff.findMany({
            where: {
              id: { in: branchStaffIds },
              organizationId: member.organizationId,
              branchId: data.branchId,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
            },
          }),
        ]);

        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_AVAILABLE");
        }

        if (services.length !== serviceIds.length) {
          throw new Error("SERVICE_NOT_AVAILABLE");
        }

        if (
          staff.length !== staffIds.length ||
          regularStaff.length !== branchStaffIds.length
        ) {
          throw new Error("STAFF_NOT_AVAILABLE");
        }

        // Get the names of login-based staff.
        const staffUsers = await tx.user.findMany({
          where: {
            id: { in: staff.map((person) => person.userId) },
          },
          select: {
            id: true,
            name: true,
          },
        });

        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        const serviceMap = new Map(
          services.map((service) => [service.id, service]),
        );

        const staffMap = new Map(staff.map((person) => [person.id, person]));

        const staffUserMap = new Map(
          staffUsers.map((person) => [person.id, person]),
        );

        const regularStaffMap = new Map(
          regularStaff.map((person) => [person.id, person]),
        );

        // Prepare individual sale lines using server-verified prices.
        const saleItems = items.map((item) => {
          const product =
            item.type === "PRODUCT" ? productMap.get(item.itemId) : undefined;

          const service =
            item.type === "SERVICE" ? serviceMap.get(item.itemId) : undefined;

          const assignedMember = item.assignedMemberId
            ? staffMap.get(item.assignedMemberId)
            : undefined;

          const assignedBranchStaff = item.assignedBranchStaffId
            ? regularStaffMap.get(item.assignedBranchStaffId)
            : undefined;

          const name = product?.name ?? service?.name;

          if (!name) {
            throw new Error(
              item.type === "PRODUCT"
                ? "PRODUCT_NOT_AVAILABLE"
                : "SERVICE_NOT_AVAILABLE",
            );
          }

          // Only services require staff assignment.
          if (
            item.type === "SERVICE" &&
            !assignedMember &&
            !assignedBranchStaff
          ) {
            throw new Error("STAFF_NOT_AVAILABLE");
          }

          const assignedUser = assignedMember
            ? staffUserMap.get(assignedMember.userId)
            : undefined;

          const assignedMemberName =
            item.type === "SERVICE"
              ? (assignedUser?.name ??
                assignedBranchStaff?.name ??
                "Staff member")
              : null;

          // Always retrieve the original price from the database.
          const originalUnitPrice = new Prisma.Decimal(
            product?.sellingPrice ?? service?.price ?? 0,
          );

          // Use the negotiated price when supplied.
          const unitPrice = item.negotiatedPrice ?? originalUnitPrice;

          if (!unitPrice.greaterThan(0)) {
            throw new Error("INVALID_TOTAL");
          }

          // Positive difference means a discount from the original price.
          const priceDifference = originalUnitPrice
            .minus(unitPrice)
            .toDecimalPlaces(2);

          const isNegotiated = !priceDifference.isZero();

          const lineTotal = unitPrice.mul(item.quantity).toDecimalPlaces(2);

          return {
            productId: product?.id ?? null,
            serviceId: service?.id ?? null,

            // Products are never assigned to staff.
            assignedMemberId:
              item.type === "SERVICE" ? (assignedMember?.id ?? null) : null,

            assignedBranchStaffId:
              item.type === "SERVICE"
                ? (assignedBranchStaff?.id ?? null)
                : null,

            assignedMemberName,

            description: name,
            quantity: item.quantity,
            unitPrice,
            originalUnitPrice,
            priceDifference,
            priceNegotiatedByMemberId: isNegotiated ? member.id : null,
            priceNegotiatedAt: isNegotiated ? new Date() : null,
            total: lineTotal,
            stockBefore: null as Prisma.Decimal | null,
            stockAfter: null as Prisma.Decimal | null,
          };
        });

        const subtotal = saleItems.reduce(
          (total, item) => total.plus(item.total),
          new Prisma.Decimal(0),
        );

        if (discount.greaterThan(subtotal)) {
          throw new Error("INVALID_DISCOUNT");
        }

        // Calculate tax on the discounted subtotal.
        const taxableAmount = subtotal.minus(discount);

        const tax = taxableAmount
          .mul(organization.defaultTaxRate)
          .div(100)
          .toDecimalPlaces(2);

        const total = taxableAmount.plus(tax);

        if (!total.greaterThan(0)) {
          throw new Error("INVALID_TOTAL");
        }

        // Validate that all payment allocations equal the full sale total.
        const paymentTotal = data.payments.reduce(
          (sum, payment) => sum.plus(new Prisma.Decimal(payment.amount)),
          new Prisma.Decimal(0),
        );

        if (!paymentTotal.equals(total)) {
          throw new Error("PAYMENT_TOTAL_MISMATCH");
        }

        // Create the sale.
        const sale = await tx.sale.create({
          data: {
            organizationId: member.organizationId,
            branchId: data.branchId,
            customerId: data.customerId || null,
            createdByMemberId: member.id,
            receiptNumber,
            status: "PAID",
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            tax: tax.toFixed(2),
            total: total.toFixed(2),
            notes: data.notes || null,
          },
          select: {
            id: true,
          },
        });

        // Deduct product stock and capture stock snapshots.
        // Services do not have stock tracking.
        for (const item of saleItems) {
          if (!item.productId) {
            continue;
          }

          const balance = await tx.inventoryBalance.findFirst({
            where: {
              organizationId: member.organizationId,
              branchId: data.branchId,
              productId: item.productId,
            },
            select: {
              quantity: true,
            },
          });

          if (!balance) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          const stockBefore = new Prisma.Decimal(balance.quantity);

          if (stockBefore.lessThan(item.quantity)) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          const stockUpdate = await tx.inventoryBalance.updateMany({
            where: {
              organizationId: member.organizationId,
              branchId: data.branchId,
              productId: item.productId,
              quantity: {
                gte: item.quantity,
              },
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          });

          if (stockUpdate.count !== 1) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          const stockAfter = stockBefore.minus(item.quantity);

          item.stockBefore = stockBefore;
          item.stockAfter = stockAfter;

          await tx.inventoryMovement.create({
            data: {
              organizationId: member.organizationId,
              branchId: data.branchId,
              productId: item.productId,
              type: "SALE",
              quantity: item.quantity.negated().toString(),
              referenceId: sale.id,
              reason: `Sale ${receiptNumber}`,
            },
          });
        }

        // Save all individual sale lines, including staff attribution
        // and product stock snapshots.
        await tx.saleItem.createMany({
          data: saleItems.map((item) => ({
            organizationId: member.organizationId,
            saleId: sale.id,
            productId: item.productId,
            serviceId: item.serviceId,
            assignedMemberId: item.assignedMemberId,
            assignedBranchStaffId: item.assignedBranchStaffId,
            assignedMemberName: item.assignedMemberName,
            stockBefore: item.stockBefore?.toFixed(3) ?? null,
            stockAfter: item.stockAfter?.toFixed(3) ?? null,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            originalUnitPrice: item.originalUnitPrice.toFixed(2),
            priceDifference: item.priceDifference.toFixed(2),
            priceNegotiatedByMemberId: item.priceNegotiatedByMemberId,
            priceNegotiatedAt: item.priceNegotiatedAt,
            total: item.total.toFixed(2),
          })),
        });

        // Record each payment allocation separately.
        await tx.payment.createMany({
          data: data.payments.map((payment) => ({
            organizationId: member.organizationId,
            saleId: sale.id,
            amount: new Prisma.Decimal(payment.amount).toFixed(2),
            method: payment.method,
            status: "COMPLETED" as const,
            paidAt: new Date(),
          })),
        });

        // Record who processed the transaction.
        await tx.auditLog.create({
          data: {
            organizationId: member.organizationId,
            branchId: data.branchId,
            actorMemberId: member.id,
            action: "SALE_CREATED",
            entityType: "SALE",
            entityId: sale.id,
            metadata: {
              receiptNumber,
              itemCount: saleItems.length,
              paymentMethods: data.payments.map((payment) => ({
                method: payment.method,
                amount: new Prisma.Decimal(payment.amount).toFixed(2),
              })),
              total: total.toFixed(2),
            },
          },
        });

        return {
          success: true as const,
          saleId: sale.id,
          receiptNumber,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    return {
      success: false,
      error: getSafeErrorMessage(error),
    };
  }
}
