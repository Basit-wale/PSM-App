"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireBranchPermission, requirePermission } from "@/lib/auth-guard";
import {
  createJournalEntrySchema,
  createLedgerAccountSchema,
} from "@/lib/validations/accounting";

type ActionResult =
  { success: true; message: string } | { success: false; error: string };

async function getAccountingContext() {
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

function safeError(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTHENTICATION_REQUIRED: "Please sign in to continue.",
      ACCESS_DENIED: "You do not have permission to perform this action.",
      ACCOUNT_NOT_AVAILABLE: "One or more selected accounts are unavailable.",
      BRANCH_NOT_AVAILABLE: "The selected branch is unavailable.",
      ENTRY_NOT_FOUND: "Journal entry not found.",
      ENTRY_NOT_DRAFT: "Only draft journal entries can be posted.",
      ENTRY_NOT_BALANCED: "Total debits must equal total credits.",
      INVALID_ENTRY_DATE: "Enter a valid journal entry date.",
    };

    if (messages[error.message]) return messages[error.message];

    if (error.message.includes("Unique constraint")) {
      return "That account code or journal entry number already exists.";
    }
  }

  console.error("Accounting action failed:", error);
  return "The accounting action could not be completed. Please try again.";
}

export async function createLedgerAccount(
  input: unknown,
): Promise<ActionResult> {
  const parsed = createLedgerAccountSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    };
  }

  try {
    const member = await getAccountingContext();

    await requirePermission(member.organizationId, "accounting:manage");

    const data = parsed.data;

    await db.ledgerAccount.create({
      data: {
        organizationId: member.organizationId,
        code: data.code.toUpperCase(),
        name: data.name,
        type: data.type,
        description: data.description || null,
      },
    });

    return {
      success: true,
      message: "Ledger account created successfully.",
    };
  } catch (error) {
    return { success: false, error: safeError(error) };
  }
}

export async function setLedgerAccountStatus(
  accountId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const member = await getAccountingContext();

    await requirePermission(member.organizationId, "accounting:manage");

    const account = await db.ledgerAccount.findFirst({
      where: {
        id: accountId,
        organizationId: member.organizationId,
      },
      select: { id: true, isSystem: true },
    });

    if (!account) throw new Error("ACCOUNT_NOT_AVAILABLE");

    if (account.isSystem && !isActive) {
      return {
        success: false,
        error: "System accounts cannot be deactivated.",
      };
    }

    await db.ledgerAccount.update({
      where: { id: account.id },
      data: { isActive },
    });

    return {
      success: true,
      message: isActive ? "Account activated." : "Account deactivated.",
    };
  } catch (error) {
    return { success: false, error: safeError(error) };
  }
}

export async function createJournalEntry(
  input: unknown,
): Promise<ActionResult> {
  const parsed = createJournalEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid journal entry.",
    };
  }

  try {
    const member = await getAccountingContext();
    const data = parsed.data;

    await requirePermission(member.organizationId, "accounting:manage");

    const entryDate = new Date(data.entryDate);

    if (Number.isNaN(entryDate.getTime())) {
      throw new Error("INVALID_ENTRY_DATE");
    }

    if (data.branchId) {
      await requireBranchPermission(
        member.organizationId,
        data.branchId,
        "accounting:manage",
      );

      const branch = await db.branch.findFirst({
        where: {
          id: data.branchId,
          organizationId: member.organizationId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (!branch) throw new Error("BRANCH_NOT_AVAILABLE");
    }

    const accountIds = [...new Set(data.lines.map((line) => line.accountId))];

    const accounts = await db.ledgerAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId: member.organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error("ACCOUNT_NOT_AVAILABLE");
    }

    const totalDebit = data.lines.reduce(
      (sum, line) => sum + Number(line.debit),
      0,
    );
    const totalCredit = data.lines.reduce(
      (sum, line) => sum + Number(line.credit),
      0,
    );

    if (
      totalDebit <= 0 ||
      Math.abs(totalDebit - totalCredit) > 0.001 ||
      data.lines.some(
        (line) =>
          (Number(line.debit) > 0 && Number(line.credit) > 0) ||
          (Number(line.debit) === 0 && Number(line.credit) === 0),
      )
    ) {
      throw new Error("ENTRY_NOT_BALANCED");
    }

    const entryNumber = await db.$transaction(async (tx) => {
      const latestEntry = await tx.journalEntry.findFirst({
        where: { organizationId: member.organizationId },
        orderBy: { createdAt: "desc" },
        select: { entryNumber: true },
      });

      const latestNumber = Number(
        latestEntry?.entryNumber.replace(/^JE-/, "") ?? 0,
      );

      const nextNumber = `JE-${String(latestNumber + 1).padStart(6, "0")}`;

      await tx.journalEntry.create({
        data: {
          organizationId: member.organizationId,
          branchId: data.branchId || null,
          createdByMemberId: member.memberId,
          entryNumber: nextNumber,
          description: data.description,
          reference: data.reference || null,
          entryDate,
          status: "DRAFT",
          lines: {
            create: data.lines.map((line) => ({
              organizationId: member.organizationId,
              accountId: line.accountId,
              description: line.description || null,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
      });

      return nextNumber;
    });

    return {
      success: true,
      message: `Journal entry ${entryNumber} saved as draft.`,
    };
  } catch (error) {
    return { success: false, error: safeError(error) };
  }
}

export async function postJournalEntry(entryId: string): Promise<ActionResult> {
  try {
    const member = await getAccountingContext();

    await requirePermission(member.organizationId, "accounting:manage");

    const entry = await db.journalEntry.findFirst({
      where: {
        id: entryId,
        organizationId: member.organizationId,
      },
      include: {
        lines: true,
      },
    });

    if (!entry) throw new Error("ENTRY_NOT_FOUND");
    if (entry.status !== "DRAFT") throw new Error("ENTRY_NOT_DRAFT");

    if (entry.branchId) {
      await requireBranchPermission(
        member.organizationId,
        entry.branchId,
        "accounting:manage",
      );
    }

    const totalDebit = entry.lines.reduce(
      (sum, line) => sum + Number(line.debit),
      0,
    );
    const totalCredit = entry.lines.reduce(
      (sum, line) => sum + Number(line.credit),
      0,
    );

    if (
      entry.lines.length < 2 ||
      totalDebit <= 0 ||
      Math.abs(totalDebit - totalCredit) > 0.001
    ) {
      throw new Error("ENTRY_NOT_BALANCED");
    }

    const result = await db.journalEntry.updateMany({
      where: {
        id: entry.id,
        organizationId: member.organizationId,
        status: "DRAFT",
      },
      data: {
        status: "POSTED",
        postedAt: new Date(),
      },
    });

    if (result.count !== 1) throw new Error("ENTRY_NOT_DRAFT");

    return {
      success: true,
      message: "Journal entry posted successfully.",
    };
  } catch (error) {
    return { success: false, error: safeError(error) };
  }
}
