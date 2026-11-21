"use server";

import { headers } from "next/headers";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";

type Result = { success: true } | { success: false; error: string };

const ASSIGNABLE_ROLES = [
  MemberRole.ADMIN,
  MemberRole.BRANCH_MANAGER,
  MemberRole.ACCOUNTANT,
  MemberRole.INVENTORY_MANAGER,
  MemberRole.RECEPTIONIST,
  MemberRole.CRM_MANAGER,
];

async function getManager() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) throw new Error("AUTH_REQUIRED");

  const member = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: { id: true, organizationId: true, role: true, userId: true },
  });

  if (!member) throw new Error("ORGANIZATION_ACCESS_REQUIRED");

  await requirePermission(member.organizationId, "members:manage");

  return member;
}

function failure(error: unknown): Result {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      ORGANIZATION_ACCESS_REQUIRED:
        "You do not have active organization access.",
      STAFF_NOT_FOUND: "Staff member not found.",
      OWNER_PROTECTED: "The organization owner cannot be modified.",
      SELF_MODIFICATION: "You cannot change your own staff access here.",
      ADMIN_PERMISSION_REQUIRED:
        "Only the organization owner can manage admin accounts.",
      INVALID_ROLE: "The selected staff role is invalid.",
      BRANCH_REQUIRED: "Select at least one active branch.",
      INVALID_BRANCH: "One or more selected branches are invalid or inactive.",
      INVITATION_NOT_FOUND: "Pending invitation not found.",
      CANNOT_ASSIGN_OWNER: "The owner role cannot be assigned.",
    };

    if (messages[error.message]) {
      return { success: false, error: messages[error.message] };
    }
  }

  console.error("Staff management action failed:", error);
  return {
    success: false,
    error: "The operation could not be completed. Please try again.",
  };
}

function validIds(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length <= 20 &&
    ids.every((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) &&
    new Set(ids).size === ids.length
  );
}

export async function updateStaffRole(
  memberId: string,
  role: string,
  branchIds: string[],
): Promise<Result> {
  try {
    const manager = await getManager();

    if (
      !memberId ||
      !ASSIGNABLE_ROLES.some((assignableRole) => assignableRole === role)
    ) {
      throw new Error("INVALID_ROLE");
    }

    if (!validIds(branchIds)) throw new Error("INVALID_BRANCH");

    if (role === MemberRole.ADMIN && manager.role !== MemberRole.OWNER) {
      throw new Error("ADMIN_PERMISSION_REQUIRED");
    }

    if (role !== MemberRole.ADMIN && branchIds.length === 0) {
      throw new Error("BRANCH_REQUIRED");
    }

    await db.$transaction(async (tx) => {
      const target = await tx.organizationMember.findFirst({
        where: { id: memberId, organizationId: manager.organizationId },
        select: { id: true, userId: true, role: true },
      });

      if (!target) throw new Error("STAFF_NOT_FOUND");
      if (target.role === MemberRole.OWNER) throw new Error("OWNER_PROTECTED");
      if (target.userId === manager.userId)
        throw new Error("SELF_MODIFICATION");

      if (
        manager.role !== MemberRole.OWNER &&
        target.role === MemberRole.ADMIN
      ) {
        throw new Error("ADMIN_PERMISSION_REQUIRED");
      }

      if (
        target.role === MemberRole.ADMIN &&
        manager.role !== MemberRole.OWNER
      ) {
        throw new Error("ADMIN_PERMISSION_REQUIRED");
      }

      if (role === MemberRole.ADMIN && manager.role !== MemberRole.OWNER) {
        throw new Error("ADMIN_PERMISSION_REQUIRED");
      }

      if (role !== MemberRole.ADMIN && branchIds.length > 0) {
        const validBranches = await tx.branch.findMany({
          where: {
            id: { in: branchIds },
            organizationId: manager.organizationId,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        if (validBranches.length !== branchIds.length) {
          throw new Error("INVALID_BRANCH");
        }
      }

      await tx.organizationMember.update({
        where: { id: target.id },
        data: { role: role as MemberRole },
      });

      await tx.branchMembership.deleteMany({
        where: {
          organizationId: manager.organizationId,
          memberId: target.id,
        },
      });

      if (role !== MemberRole.ADMIN) {
        await tx.branchMembership.createMany({
          data: branchIds.map((branchId) => ({
            organizationId: manager.organizationId,
            memberId: target.id,
            branchId,
          })),
        });
      }
    });

    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setStaffStatus(
  memberId: string,
  isActive: boolean,
): Promise<Result> {
  try {
    const manager = await getManager();

    if (typeof isActive !== "boolean" || !memberId) {
      throw new Error("STAFF_NOT_FOUND");
    }

    const target = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId: manager.organizationId },
      select: { id: true, userId: true, role: true },
    });

    if (!target) throw new Error("STAFF_NOT_FOUND");
    if (target.role === MemberRole.OWNER) throw new Error("OWNER_PROTECTED");
    if (target.userId === manager.userId) throw new Error("SELF_MODIFICATION");

    if (manager.role !== MemberRole.OWNER && target.role === MemberRole.ADMIN) {
      throw new Error("ADMIN_PERMISSION_REQUIRED");
    }

    await db.organizationMember.update({
      where: { id: target.id },
      data: { isActive },
    });

    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeStaffInvitation(
  invitationId: string,
): Promise<Result> {
  try {
    const manager = await getManager();

    if (!invitationId) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    const invitation = await db.staffInvitation.findFirst({
      where: {
        id: invitationId,
        organizationId: manager.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!invitation) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    if (
      invitation.role === MemberRole.ADMIN &&
      manager.role !== MemberRole.OWNER
    ) {
      throw new Error("ADMIN_PERMISSION_REQUIRED");
    }

    const result = await db.staffInvitation.updateMany({
      where: {
        id: invitation.id,
        organizationId: manager.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new Error("INVITATION_NOT_FOUND");
    }

    return { success: true };
  } catch (error) {
    return failure(error);
  }
}
