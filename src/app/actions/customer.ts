"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireBranchPermission } from "@/lib/auth-guard";
import { createCustomerSchema } from "@/lib/validations/customer";
import { z } from "zod";

type ActionResult =
  | {
      success: true;
      customerId: string;
      existingCustomer: boolean;
      requiresConfirmation?: false;
    }
  | {
      success: true;
      existingCustomer: true;
      requiresConfirmation: true;
      existingCustomerName: string;
    }
  | {
      success: false;
      error: string;
    };

const createCustomerInputSchema = z.object({
  branchId: z.string().uuid("Invalid branch."),
  customer: createCustomerSchema,
  confirmExisting: z.boolean().optional().default(false),
});

const updateCustomerInputSchema = z.object({
  customerId: z.string().uuid("Invalid customer."),
  branchId: z.string().uuid("Invalid branch."),
  customer: createCustomerSchema,
});

async function getCustomerManagementContext() {
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
    },
  });

  if (!member) {
    throw new Error("ORGANIZATION_ACCESS_REQUIRED");
  }

  return member;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, "");
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      ORGANIZATION_ACCESS_REQUIRED:
        "You do not have active organization access.",
      "You do not have permission to perform this action.":
        "You do not have permission to manage customers.",
      "Branch not found or inactive.": "The selected branch is unavailable.",
      CUSTOMER_NOT_FOUND: "Customer not found in this branch.",
    };

    if (messages[error.message]) {
      return messages[error.message];
    }
  }

  console.error("Customer action failed:", error);

  return "The operation could not be completed. Please try again.";
}

export async function createCustomer(input: unknown): Promise<ActionResult> {
  const parsed = createCustomerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid customer details.",
    };
  }

  try {
    const context = await getCustomerManagementContext();

    const { branchId, customer, confirmExisting } = parsed.data;

    await requireBranchPermission(
      context.organizationId,
      branchId,
      "customers:manage",
    );

    const phone = normalizePhone(customer.phone);

    return await db.$transaction(async (tx) => {
      // Prevent simultaneous creation or merging of the same phone number.
      await tx.$queryRaw<{ locked: number }[]>`
        WITH lock_result AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${context.organizationId + ":" + phone},
              3
            )
          )
        )
        SELECT 1 AS locked
        FROM lock_result
      `;

      const existing = await tx.customer.findUnique({
        where: {
          organizationId_phone: {
            organizationId: context.organizationId,
            phone,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      if (existing) {
        // First request only detects the duplicate. It changes nothing.
        if (!confirmExisting) {
          return {
            success: true,
            existingCustomer: true,
            requiresConfirmation: true,
            existingCustomerName:
              `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
          };
        }

        // Update the existing shared customer profile only after confirmation.
        await tx.customer.update({
          where: {
            id: existing.id,
          },
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName || null,
            phone,
            email: customer.email || null,
            dateOfBirth: customer.dateOfBirth
              ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
              : null,
            whatsappOptIn: customer.whatsappOptIn,
            smsOptIn: customer.smsOptIn,
            notes: customer.notes || null,
          },
        });

        // Preserve existing branch links and add the selected branch.
        await tx.customerBranch.upsert({
          where: {
            customerId_branchId: {
              customerId: existing.id,
              branchId,
            },
          },
          create: {
            organizationId: context.organizationId,
            customerId: existing.id,
            branchId,
          },
          update: {},
        });

        return {
          success: true,
          customerId: existing.id,
          existingCustomer: true,
        };
      }

      const created = await tx.customer.create({
        data: {
          organizationId: context.organizationId,
          firstName: customer.firstName,
          lastName: customer.lastName || null,
          phone,
          email: customer.email || null,
          dateOfBirth: customer.dateOfBirth
            ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
            : null,
          whatsappOptIn: customer.whatsappOptIn,
          smsOptIn: customer.smsOptIn,
          notes: customer.notes || null,
          branches: {
            create: {
              branch: {
                connect: {
                  id_organizationId: {
                    id: branchId,
                    organizationId: context.organizationId,
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      return {
        success: true,
        customerId: created.id,
        existingCustomer: false,
      };
    });
  } catch (error) {
    return {
      success: false,
      error: getSafeErrorMessage(error),
    };
  }
}

export async function updateCustomer(input: unknown): Promise<ActionResult> {
  const parsed = updateCustomerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid customer details.",
    };
  }

  try {
    const context = await getCustomerManagementContext();

    const { customerId, branchId, customer } = parsed.data;

    await requireBranchPermission(
      context.organizationId,
      branchId,
      "customers:manage",
    );

    const result = await db.customer.updateMany({
      where: {
        id: customerId,
        organizationId: context.organizationId,
        branches: {
          some: {
            branchId,
            organizationId: context.organizationId,
          },
        },
      },
      data: {
        firstName: customer.firstName,
        lastName: customer.lastName || null,
        phone: normalizePhone(customer.phone),
        email: customer.email || null,
        dateOfBirth: customer.dateOfBirth
          ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
          : null,
        whatsappOptIn: customer.whatsappOptIn,
        smsOptIn: customer.smsOptIn,
        notes: customer.notes || null,
      },
    });

    if (result.count === 0) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    return {
      success: true,
      customerId,
      existingCustomer: true,
    };
  } catch (error) {
    const isUniqueConstraint =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";

    return {
      success: false,
      error: isUniqueConstraint
        ? "Another customer already uses this phone number."
        : getSafeErrorMessage(error),
    };
  }
}
