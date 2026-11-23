import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { AccountingManager } from "@/components/accounting/accounting-manager";

export const instant = false;

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash", type: "ASSET" as const },
  { code: "1100", name: "Bank", type: "ASSET" as const },
  { code: "1200", name: "Accounts Receivable", type: "ASSET" as const },
  { code: "1500", name: "Equipment", type: "ASSET" as const },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" as const },
  { code: "2100", name: "Tax Payable", type: "LIABILITY" as const },
  { code: "3000", name: "Owner's Equity", type: "EQUITY" as const },
  { code: "4000", name: "Service Revenue", type: "REVENUE" as const },
  { code: "4100", name: "Product Sales", type: "REVENUE" as const },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" as const },
  { code: "6000", name: "Rent", type: "EXPENSE" as const },
  { code: "6100", name: "Salaries", type: "EXPENSE" as const },
  { code: "6200", name: "Utilities", type: "EXPENSE" as const },
  { code: "6300", name: "Supplies", type: "EXPENSE" as const },
  { code: "6400", name: "Marketing", type: "EXPENSE" as const },
];

export default async function AccountingPage() {
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

  // Only owners and accountants can access Accounting.
  if (
    member.role !== MemberRole.OWNER &&
    member.role !== MemberRole.ACCOUNTANT
  ) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Only organization owners and accountants can access accounting.
        </p>
      </div>
    );
  }

  const context = await requirePermission(
    member.organizationId,
    "accounting:read",
  );

  const isOrganizationAdmin =
    context.role === MemberRole.OWNER || context.role === MemberRole.ADMIN;

  await db.ledgerAccount.createMany({
    data: DEFAULT_ACCOUNTS.map((account) => ({
      organizationId: member.organizationId,
      ...account,
      isSystem: true,
    })),
    skipDuplicates: true,
  });

  const branchWhere = {
    organizationId: member.organizationId,
    status: "ACTIVE" as const,
    ...(isOrganizationAdmin ? {} : { id: { in: context.branchIds } }),
  };

  const branches = await db.branch.findMany({
    where: branchWhere,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  const accounts = await db.ledgerAccount.findMany({
    where: {
      organizationId: member.organizationId,
    },
    orderBy: { code: "asc" },
  });

  const entries = await db.journalEntry.findMany({
    where: {
      organizationId: member.organizationId,
      ...(isOrganizationAdmin ? {} : { branchId: { in: context.branchIds } }),
    },
    include: {
      branch: {
        select: { name: true },
      },
      lines: {
        include: {
          account: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 100,
  });

  const formattedAccounts = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    description: account.description,
    isActive: account.isActive,
    isSystem: account.isSystem,
  }));

  const formattedEntries = entries.map((entry) => ({
    id: entry.id,
    entryNumber: entry.entryNumber,
    description: entry.description,
    reference: entry.reference,
    status: entry.status,
    entryDate: entry.entryDate.toISOString(),
    postedAt: entry.postedAt?.toISOString() ?? null,
    branchName: entry.branch?.name ?? "Organization-wide",
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountId: line.accountId,
      accountCode: line.account.code,
      accountName: line.account.name,
      description: line.description,
      debit: line.debit.toString(),
      credit: line.credit.toString(),
    })),
  }));

  return (
    <AccountingManager
      accounts={formattedAccounts}
      entries={formattedEntries}
      branches={branches}
      currency="NGN"
      canManage={hasPermission(context.role, "accounting:manage")}
    />
  );
}
