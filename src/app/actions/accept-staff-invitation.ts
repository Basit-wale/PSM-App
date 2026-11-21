"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type AcceptInvitationResult =
  { success: true } | { success: false; error: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function acceptStaffInvitation(
  input: unknown,
): Promise<AcceptInvitationResult> {
  if (typeof input !== "string" || !/^[a-f0-9]{64}$/i.test(input)) {
    return {
      success: false,
      error: "This invitation link is invalid.",
    };
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false,
        error: "Please sign in or create an account first.",
      };
    }

    const tokenHash = hashToken(input);
    const now = new Date();

    await db.$transaction(async (tx) => {
      // Prevent two requests from accepting the same invitation.
      await tx.$queryRaw<{ locked: number }[]>`
        WITH lock_result AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(${tokenHash}, 3)
          )
        )
        SELECT 1 AS locked
        FROM lock_result
      `;

      const invitation = await tx.staffInvitation.findUnique({
        where: {
          tokenHash,
        },
        include: {
          branches: {
            select: {
              branchId: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new Error("INVITATION_INVALID");
      }

      if (invitation.acceptedAt) {
        throw new Error("INVITATION_USED");
      }

      if (invitation.revokedAt) {
        throw new Error("INVITATION_REVOKED");
      }

      if (invitation.expiresAt <= now) {
        throw new Error("INVITATION_EXPIRED");
      }

      // The signed-in account must match the invited email.
      if (
        session.user.email.trim().toLowerCase() !==
        invitation.email.trim().toLowerCase()
      ) {
        throw new Error("INVITATION_EMAIL_MISMATCH");
      }

      // Ensure the assigned branches are still active.
      const branchIds = invitation.branches.map((branch) => branch.branchId);

      if (branchIds.length > 0) {
        const activeBranches = await tx.branch.findMany({
          where: {
            id: {
              in: branchIds,
            },
            organizationId: invitation.organizationId,
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        });

        if (activeBranches.length !== branchIds.length) {
          throw new Error("INVITATION_BRANCH_UNAVAILABLE");
        }
      }

      // A user can only have one membership per organization.
      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: session.user.id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingMembership) {
        throw new Error("MEMBERSHIP_ALREADY_EXISTS");
      }

      const member = await tx.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (branchIds.length > 0) {
        await tx.branchMembership.createMany({
          data: branchIds.map((branchId) => ({
            organizationId: invitation.organizationId,
            branchId,
            memberId: member.id,
          })),
          skipDuplicates: true,
        });
      }

      // Mark the invitation as accepted inside the same transaction.
      await tx.staffInvitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          acceptedAt: now,
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Staff invitation acceptance failed:", error);

    const messages: Record<string, string> = {
      INVITATION_INVALID: "This invitation link is invalid.",
      INVITATION_USED: "This invitation has already been used.",
      INVITATION_REVOKED: "This invitation has been revoked.",
      INVITATION_EXPIRED: "This invitation has expired.",
      INVITATION_EMAIL_MISMATCH:
        "Please sign in with the email address this invitation was sent to.",
      INVITATION_BRANCH_UNAVAILABLE:
        "One or more assigned branches are no longer available. Contact your administrator.",
      MEMBERSHIP_ALREADY_EXISTS:
        "You already have a membership in this organization.",
    };

    const errorMessage =
      error instanceof Error ? messages[error.message] : undefined;

    return {
      success: false,
      error:
        errorMessage ?? "Unable to accept this invitation. Please try again.",
    };
  }
}
