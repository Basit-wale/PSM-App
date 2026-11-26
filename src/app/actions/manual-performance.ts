"use server";

import { headers } from "next/headers";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type ActionResult =
  { success: true; message: string } | { success: false; error: string };

async function getOwnerContext() {
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
      userId: true,
      role: true,
    },
  });

  if (!member || member.role !== MemberRole.OWNER) {
    throw new Error("OWNER_ONLY");
  }

  return member;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTHENTICATION_REQUIRED: "Please sign in to continue.",
      OWNER_ONLY: "Only the organization owner can access manual performance.",
      INVALID_INPUT: "Please check the information you entered.",
      BRANCH_NOT_FOUND: "Manual branch not found.",
      STAFF_NOT_FOUND: "Manual staff member not found.",
      INVALID_DATE: "Please enter a valid work date.",
      INVALID_REVENUE: "Revenue must be a valid amount of zero or more.",
    };

    return (
      messages[error.message] ??
      "The operation could not be completed. Please try again."
    );
  }

  return "The operation could not be completed. Please try again.";
}

function handleError(error: unknown): ActionResult {
  console.error("Manual performance error:", error);
  return { success: false, error: getErrorMessage(error) };
}

export async function createManualBranch(input: {
  name: string;
  phone?: string;
  address?: string;
}): Promise<ActionResult> {
  try {
    const owner = await getOwnerContext();

    const name = input.name?.trim();
    if (!name) throw new Error("INVALID_INPUT");

    await db.manualBranch.create({
      data: {
        organizationId: owner.organizationId,
        name,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      },
    });

    return { success: true, message: "Manual branch created." };
  } catch (error) {
    return handleError(error);
  }
}

export async function createManualStaff(input: {
  branchId: string;
  name: string;
  phone?: string;
}): Promise<ActionResult> {
  try {
    const owner = await getOwnerContext();

    const name = input.name?.trim();
    if (!name || !input.branchId) throw new Error("INVALID_INPUT");

    const branch = await db.manualBranch.findFirst({
      where: {
        id: input.branchId,
        organizationId: owner.organizationId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!branch) throw new Error("BRANCH_NOT_FOUND");

    await db.manualStaff.create({
      data: {
        organizationId: owner.organizationId,
        branchId: branch.id,
        name,
        phone: input.phone?.trim() || null,
      },
    });

    return { success: true, message: "Manual staff member added." };
  } catch (error) {
    return handleError(error);
  }
}

export async function saveManualPerformanceEntry(input: {
  branchId: string;
  staffId: string;
  workDate: string;
  revenue: number;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const owner = await getOwnerContext();

    if (!input.branchId || !input.staffId) {
      throw new Error("INVALID_INPUT");
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate) ||
      new Date(`${input.workDate}T00:00:00.000Z`).toISOString().slice(0, 10) !==
        input.workDate
    ) {
      throw new Error("INVALID_DATE");
    }

    const revenue = Number(input.revenue);

    if (!Number.isFinite(revenue) || revenue < 0) {
      throw new Error("INVALID_REVENUE");
    }

    const staff = await db.manualStaff.findFirst({
      where: {
        id: input.staffId,
        branchId: input.branchId,
        organizationId: owner.organizationId,
        isActive: true,
        branch: { isActive: true },
      },
      select: { id: true },
    });

    if (!staff) throw new Error("STAFF_NOT_FOUND");

    const workDate = new Date(`${input.workDate}T00:00:00.000Z`);

    await db.manualPerformanceEntry.upsert({
      where: {
        staffId_workDate: {
          staffId: staff.id,
          workDate,
        },
      },
      create: {
        organizationId: owner.organizationId,
        branchId: input.branchId,
        staffId: staff.id,
        workDate,
        revenue,
        notes: input.notes?.trim() || null,
        createdByUserId: owner.userId,
      },
      update: {
        revenue,
        notes: input.notes?.trim() || null,
      },
    });

    return {
      success: true,
      message: "Daily performance saved successfully.",
    };
  } catch (error) {
    return handleError(error);
  }
}

export async function getManualPerformanceData() {
  const owner = await getOwnerContext();

  const [branches, entries] = await Promise.all([
    db.manualBranch.findMany({
      where: { organizationId: owner.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        staff: {
          orderBy: { name: "asc" },
        },
      },
    }),

    db.manualPerformanceEntry.findMany({
      where: { organizationId: owner.organizationId },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      include: {
        branch: { select: { name: true } },
        staff: { select: { name: true } },
      },
    }),
  ]);

  return {
    branches,
    entries: entries.map((entry) => ({
      id: entry.id,
      branchId: entry.branchId,
      branchName: entry.branch.name,
      staffId: entry.staffId,
      staffName: entry.staff.name,
      workDate: entry.workDate.toISOString().slice(0, 10),
      revenue: Number(entry.revenue),
      notes: entry.notes,
    })),
  };
}

export async function setManualBranchStatus(
  branchId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const owner = await getOwnerContext();

    const result = await db.manualBranch.updateMany({
      where: {
        id: branchId,
        organizationId: owner.organizationId,
      },
      data: { isActive },
    });

    if (result.count === 0) throw new Error("BRANCH_NOT_FOUND");

    return {
      success: true,
      message: isActive ? "Branch activated." : "Branch archived.",
    };
  } catch (error) {
    return handleError(error);
  }
}

export async function setManualStaffStatus(
  staffId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const owner = await getOwnerContext();

    const result = await db.manualStaff.updateMany({
      where: {
        id: staffId,
        organizationId: owner.organizationId,
      },
      data: { isActive },
    });

    if (result.count === 0) throw new Error("STAFF_NOT_FOUND");

    return {
      success: true,
      message: isActive ? "Staff member activated." : "Staff member archived.",
    };
  } catch (error) {
    return handleError(error);
  }
}
