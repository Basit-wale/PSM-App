"use server";

import { db } from "@/lib/db";
import { requireBranchPermission, requirePermission } from "@/lib/auth-guard";
import { createExpenseSchema } from "@/lib/validations/expense";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

async function getExpenseContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("AUTHENTICATION_REQUIRED");

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

  if (!member) throw new Error("ACCESS_DENIED");

  return {
    memberId: member.id,
    organizationId: member.organizationId,
  };
}

type ActionResult =
  { success: true; message: string } | { success: false; error: string };

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTHENTICATION_REQUIRED: "Please sign in to continue.",
      ACCESS_DENIED: "You do not have permission to perform this action.",
      RESOURCE_NOT_FOUND: "The requested resource was not found.",
      "Branch not found or inactive.": "The selected branch is unavailable.",
      "You do not have access to this branch.":
        "You do not have access to the selected branch.",
      CATEGORY_NOT_AVAILABLE: "The selected expense category is unavailable.",
      EXPENSE_NOT_FOUND: "The expense could not be found.",
      INVALID_EXPENSE_STATUS: "This expense cannot be moved to that status.",
    };

    if (messages[error.message]) return messages[error.message];
    if (error.message.includes("Unique constraint")) {
      return "An expense category with this name already exists.";
    }
  }

  console.error("Expense action failed:", error);
  return "The expense action could not be completed. Please try again.";
}

export async function createExpense(input: unknown): Promise<ActionResult> {
  const parsed = createExpenseSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid expense details.",
    };
  }

  try {
    const data = parsed.data;
    const member = await getExpenseContext();

    await requireBranchPermission(
      member.organizationId,
      data.branchId,
      "expenses:create",
    );

    const category = await db.expenseCategory.findFirst({
      where: {
        id: data.categoryId,
        organizationId: member.organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) throw new Error("CATEGORY_NOT_AVAILABLE");

    const expenseDate = new Date(data.expenseDate);

    if (Number.isNaN(expenseDate.getTime())) {
      return {
        success: false,
        error: "Enter a valid expense date.",
      };
    }

    await db.expense.create({
      data: {
        organizationId: member.organizationId,
        branchId: data.branchId,
        categoryId: data.categoryId,
        submittedByMemberId: member.memberId,
        description: data.description,
        amount: data.amount,
        vendor: data.vendor || null,
        reference: data.reference || null,
        expenseDate,
        status: "PENDING",
      },
    });

    return {
      success: true,
      message: "Expense submitted successfully.",
    };
  } catch (error) {
    return {
      success: false,
      error: safeError(error),
    };
  }
}

export async function createExpenseCategory(
  name: string,
  description?: string,
): Promise<ActionResult> {
  try {
    const member = await getExpenseContext();

    await requirePermission(member.organizationId, "accounting:manage");

    const cleanName = name.trim();

    if (cleanName.length < 2 || cleanName.length > 100) {
      return {
        success: false,
        error: "Category name must be between 2 and 100 characters.",
      };
    }

    await db.expenseCategory.create({
      data: {
        organizationId: member.organizationId,
        name: cleanName,
        description: description?.trim() || null,
      },
    });

    return {
      success: true,
      message: "Expense category created.",
    };
  } catch (error) {
    return {
      success: false,
      error: safeError(error),
    };
  }
}

export async function reviewExpense(
  expenseId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<ActionResult> {
  try {
    const member = await getExpenseContext();

    await requirePermission(member.organizationId, "expenses:approve");

    const expense = await db.expense.findFirst({
      where: {
        id: expenseId,
        organizationId: member.organizationId,
      },
      select: {
        id: true,
        branchId: true,
        status: true,
      },
    });

    if (!expense) throw new Error("EXPENSE_NOT_FOUND");

    await requireBranchPermission(
      member.organizationId,
      expense.branchId,
      "expenses:approve",
    );

    if (expense.status !== "PENDING") {
      throw new Error("INVALID_EXPENSE_STATUS");
    }

    const result = await db.expense.updateMany({
      where: {
        id: expense.id,
        organizationId: member.organizationId,
        status: "PENDING",
      },
      data: {
        status: decision,
        approvedByMemberId: decision === "APPROVED" ? member.memberId : null,
        approvedAt: decision === "APPROVED" ? new Date() : null,
      },
    });

    if (result.count !== 1) {
      throw new Error("INVALID_EXPENSE_STATUS");
    }

    return {
      success: true,
      message:
        decision === "APPROVED" ? "Expense approved." : "Expense rejected.",
    };
  } catch (error) {
    return {
      success: false,
      error: safeError(error),
    };
  }
}

export async function markExpensePaid(
  expenseId: string,
): Promise<ActionResult> {
  try {
    const member = await getExpenseContext();

    await requirePermission(member.organizationId, "accounting:manage");

    const expense = await db.expense.findFirst({
      where: {
        id: expenseId,
        organizationId: member.organizationId,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (!expense) throw new Error("EXPENSE_NOT_FOUND");

    await requireBranchPermission(
      member.organizationId,
      expense.branchId,
      "accounting:manage",
    );

    const result = await db.expense.updateMany({
      where: {
        id: expense.id,
        organizationId: member.organizationId,
        status: "APPROVED",
      },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new Error("INVALID_EXPENSE_STATUS");
    }

    return {
      success: true,
      message: "Expense marked as paid.",
    };
  } catch (error) {
    return {
      success: false,
      error: safeError(error),
    };
  }
}
