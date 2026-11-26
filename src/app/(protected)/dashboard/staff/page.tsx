import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, AuthorizationError } from "@/lib/auth-guard";
import { StaffManager } from "@/components/staff/staff-manager";
import { AccessDenied } from "@/components/shared/access-denied";

export const instant = false;

export default async function StaffPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!membership) redirect("/setup");

  let context;

  try {
    context = await requirePermission(
      membership.organizationId,
      "members:read",
    );
  } catch (error) {
    if (error instanceof AuthorizationError && error.statusCode === 403) {
      return (
        <AccessDenied
          title="Staff access restricted"
          description="Your assigned role does not allow you to view staff information. Contact your organization administrator if you need access."
        />
      );
    }

    throw error;
  }

  const canManageStaff =
    context.role === MemberRole.OWNER || context.role === MemberRole.ADMIN;

  const canInviteAdmin = context.role === MemberRole.OWNER;

  const branchScope = canManageStaff
    ? {}
    : {
        id: {
          in: context.branchIds,
        },
      };

  const memberBranchScope = canManageStaff
    ? {}
    : {
        branches: {
          some: {
            branchId: {
              in: context.branchIds,
            },
          },
        },
      };

  const invitationBranchScope = canManageStaff
    ? {}
    : {
        branches: {
          some: {
            branchId: {
              in: context.branchIds,
            },
          },
        },
      };

  const [branches, members, invitations, branchStaff] = await Promise.all([
    db.branch.findMany({
      where: {
        organizationId: membership.organizationId,
        status: "ACTIVE",
        ...branchScope,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    }),

    db.organizationMember.findMany({
      where: {
        organizationId: membership.organizationId,
        ...memberBranchScope,
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),

    db.staffInvitation.findMany({
      where: {
        organizationId: membership.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...invitationBranchScope,
      },
      orderBy: { createdAt: "desc" },
      include: {
        branches: {
          include: {
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),

    db.branchStaff.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(canManageStaff ? {} : { branchId: { in: context.branchIds } }),
      },
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return (
    <StaffManager
      branches={branches}
      members={members.map((member) => ({
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        isActive: member.isActive,
        branches: member.branches.map((item) => item.branch.name),
        branchIds: member.branches.map((item) => item.branch.id),
      }))}
      invitations={invitations.map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
        branches: invitation.branches.map((item) => item.branch.name),
      }))}
      currentMemberId={context.memberId}
      canManageStaff={canManageStaff}
      canInviteAdmin={canInviteAdmin}
      branchStaff={branchStaff.map((person) => ({
        id: person.id,
        name: person.name,
        phone: person.phone,
        isActive: person.isActive,
        branchId: person.branchId,
        branchName: person.branch.name,
      }))}
    />
  );
}
