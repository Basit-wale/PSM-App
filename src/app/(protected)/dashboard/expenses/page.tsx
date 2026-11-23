import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { ExpenseManager } from "@/components/expenses/expense-manager";

export const instant = false;

const DEFAULT_CATEGORIES = [
  "Rent",
  "Utilities",
  "Supplies",
  "Salaries",
  "Maintenance",
  "Marketing",
  "Other",
];

export default async function ExpensesPage() {
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
      id: true,
      organizationId: true,
    },
  });

  if (!member) redirect("/setup");

  let context;

  try {
    context = await requirePermission(member.organizationId, "expenses:read");
  } catch {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-neutral-600">
          You do not have permission to view expenses.
        </p>
      </div>
    );
  }

  const isOrganizationAdmin =
    context.role === MemberRole.OWNER || context.role === MemberRole.ADMIN;

  const isFinancialApprover =
    context.role === MemberRole.OWNER || context.role === MemberRole.ACCOUNTANT;

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

  await db.expenseCategory.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({
      organizationId: member.organizationId,
      name,
    })),
    skipDuplicates: true,
  });

  const categories = await db.expenseCategory.findMany({
    where: {
      organizationId: member.organizationId,
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const expenses = await db.expense.findMany({
    where: {
      organizationId: member.organizationId,
      branchId: { in: branches.map((branch) => branch.id) },
    },
    include: {
      branch: {
        select: { name: true },
      },
      category: {
        select: { name: true },
      },
    },
    orderBy: {
      expenseDate: "desc",
    },
  });

  const formattedExpenses = expenses.map((expense) => ({
    id: expense.id,
    branchId: expense.branchId,
    branchName: expense.branch.name,
    categoryName: expense.category.name,
    description: expense.description,
    amount: expense.amount.toString(),
    vendor: expense.vendor,
    reference: expense.reference,
    status: expense.status,
    expenseDate: expense.expenseDate.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    paidAt: expense.paidAt?.toISOString() ?? null,
    submittedByMemberId: expense.submittedByMemberId,
  }));

  return (
    <ExpenseManager
      branches={branches}
      categories={categories}
      expenses={formattedExpenses}
      currentMemberId={member.id}
      canCreate={hasPermission(context.role, "expenses:create")}
      canApprove={
        isFinancialApprover && hasPermission(context.role, "expenses:approve")
      }
      canPay={
        isFinancialApprover && hasPermission(context.role, "accounting:manage")
      }
      canManageCategories={
        isFinancialApprover && hasPermission(context.role, "accounting:manage")
      }
    />
  );
}
