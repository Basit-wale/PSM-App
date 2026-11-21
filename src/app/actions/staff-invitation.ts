"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { createStaffInvitationSchema } from "@/lib/validations/staff-invitation";

type ActionResult =
  | {
      success: true;
      invitationId: string;
      invitationUrl: string;
      expiresAt: string;
    }
  | {
      success: false;
      error: string;
    };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getStaffManagementContext() {
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
      id: true,
      organizationId: true,
      role: true,
    },
  });

  if (!membership) {
    throw new Error("You do not belong to an active organization.");
  }

  await requirePermission(membership.organizationId, "members:manage");

  return {
    ...membership,
  };
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (
      error.message.includes("permission") ||
      error.message.includes("active access")
    ) {
      return "You do not have permission to manage staff.";
    }

    if (
      error.message.includes("sign in") ||
      error.message.includes("Authentication")
    ) {
      return "Please sign in to continue.";
    }

    if (error.message.includes("active organization")) {
      return "You do not belong to an active organization.";
    }

    if (error.message.includes("ADMIN_INVITE_FORBIDDEN")) {
      return "Only the organization owner can invite an admin.";
    }

    if (error.message.includes("BRANCH_ACCESS_INVALID")) {
      return "One or more selected branches are invalid or inactive.";
    }

    if (error.message.includes("MEMBER_ALREADY_EXISTS")) {
      return "This email address already belongs to your organization.";
    }

    if (error.message.includes("INVITATION_ALREADY_PENDING")) {
      return "A pending invitation already exists for this email address.";
    }
  }

  return "Unable to create the invitation. Please try again.";
}

export async function createStaffInvitation(
  input: unknown,
): Promise<ActionResult> {
  const parsed = createStaffInvitationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid invitation details.",
    };
  }

  try {
    const context = await getStaffManagementContext();

    const { email, role, branchIds } = parsed.data;

    // Validate the application URL before creating the invitation.
    const appUrl = process.env.APP_URL;

    if (!appUrl) {
      return {
        success: false,
        error: "The application URL is not configured.",
      };
    }

    let baseUrl: URL;

    try {
      baseUrl = new URL(appUrl);
    } catch {
      return {
        success: false,
        error: "The application URL is invalid.",
      };
    }

    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return {
        success: false,
        error: "The application URL must use HTTP or HTTPS.",
      };
    }

    // Only the owner can invite an admin.
    if (role === MemberRole.ADMIN && context.role !== MemberRole.OWNER) {
      throw new Error("ADMIN_INVITE_FORBIDDEN");
    }

    const normalizedBranchIds = [...new Set(branchIds)];

    // Generate a cryptographically secure invitation token.
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);

    // Invitation expires after seven days.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await db.$transaction(async (tx) => {
      // Serialize invitations for the same email within this organization.
      await tx.$queryRaw<{ locked: number }[]>`
        WITH lock_result AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${context.organizationId + ":" + email},
              2
            )
          )
        )
        SELECT 1 AS locked
        FROM lock_result
      `;

      // Verify that every selected branch is active and belongs
      // to the current organization.
      if (normalizedBranchIds.length > 0) {
        const validBranches = await tx.branch.findMany({
          where: {
            id: {
              in: normalizedBranchIds,
            },
            organizationId: context.organizationId,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

        if (validBranches.length !== normalizedBranchIds.length) {
          throw new Error("BRANCH_ACCESS_INVALID");
        }
      }

      // Prevent inviting an existing active organization member.
      const existingMember = await tx.organizationMember.findFirst({
        where: {
          organizationId: context.organizationId,
          user: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (existingMember) {
        throw new Error("MEMBER_ALREADY_EXISTS");
      }

      // Prevent duplicate pending invitations.
      const pendingInvitation = await tx.staffInvitation.findFirst({
        where: {
          organizationId: context.organizationId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (pendingInvitation) {
        throw new Error("INVITATION_ALREADY_PENDING");
      }

      // Create the invitation and its branch assignments.
      return tx.staffInvitation.create({
        data: {
          organizationId: context.organizationId,
          createdByMemberId: context.id,
          email,
          role,
          tokenHash,
          expiresAt,
          branches: {
            create: normalizedBranchIds.map((branchId) => ({
              branch: {
                connect: {
                  id_organizationId: {
                    id: branchId,
                    organizationId: context.organizationId,
                  },
                },
              },
            })),
          },
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });
    });

    // Build the invitation URL using the validated application URL.
    const invitationUrl = new URL(`/invite/${token}`, baseUrl).toString();

    return {
      success: true,
      invitationId: invitation.id,
      invitationUrl,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Staff invitation creation failed:", error);

    return {
      success: false,
      error: getSafeErrorMessage(error),
    };
  }
}
