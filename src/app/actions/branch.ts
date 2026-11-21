"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import {
  branchIdSchema,
  branchStatusSchema,
  createBranchSchema,
  updateBranchSchema,
} from "@/lib/validations/branch";

type ActionResult = { success: true } | { success: false; error: string };

async function getBranchManagementContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Please sign in to continue.");
  }

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!membership) {
    throw new Error("You do not belong to an active organization.");
  }

  await requirePermission(membership.organizationId, "branches:manage");

  return membership.organizationId;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("permission")) {
      return "You do not have permission to manage branches.";
    }

    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function createBranch(input: unknown): Promise<ActionResult> {
  const parsed = createBranchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid branch details.",
    };
  }

  try {
    const organizationId = await getBranchManagementContext();

    const { name, code, address, phone, email } = parsed.data;

    await db.branch.create({
      data: {
        organizationId,
        name,
        code,
        address: address || null,
        phone: phone || null,
        email: email || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Branch creation failed:", error);

    return {
      success: false,
      error: isUniqueConstraintError(error)
        ? "A branch with this code already exists."
        : getErrorMessage(error),
    };
  }
}

export async function updateBranch(input: unknown): Promise<ActionResult> {
  const parsed = updateBranchSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid branch details.",
    };
  }

  try {
    const organizationId = await getBranchManagementContext();

    const { id, name, code, address, phone, email } = parsed.data;

    const result = await db.branch.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        name,
        code,
        address: address || null,
        phone: phone || null,
        email: email || null,
      },
    });

    if (result.count === 0) {
      return {
        success: false,
        error: "Branch not found.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Branch update failed:", error);

    return {
      success: false,
      error: isUniqueConstraintError(error)
        ? "A branch with this code already exists."
        : getErrorMessage(error),
    };
  }
}

export async function setBranchStatus(input: unknown): Promise<ActionResult> {
  const parsed = branchStatusSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid branch status.",
    };
  }

  try {
    const organizationId = await getBranchManagementContext();
    const { id, status } = parsed.data;

    await db.$transaction(async (tx) => {
      // Serialize branch status changes within this organization.
      await tx.$queryRaw<{ locked: number }[]>`
        WITH lock_result AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${organizationId}, 1)
          )
        )
        SELECT 1 AS locked
        FROM lock_result
      `;

      const branch = await tx.branch.findFirst({
        where: {
          id,
          organizationId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!branch) {
        throw new Error("Branch not found.");
      }

      if (branch.status === status) {
        return;
      }

      if (status === "INACTIVE") {
        const activeBranchCount = await tx.branch.count({
          where: {
            organizationId,
            status: "ACTIVE",
          },
        });

        if (activeBranchCount <= 1) {
          throw new Error("You cannot deactivate the last active branch.");
        }
      }

      await tx.branch.update({
        where: {
          id: branch.id,
        },
        data: {
          status,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Branch status update failed:", error);

    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

export async function validateBranchId(input: unknown): Promise<ActionResult> {
  const parsed = branchIdSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid branch ID.",
    };
  }

  return { success: true };
}
