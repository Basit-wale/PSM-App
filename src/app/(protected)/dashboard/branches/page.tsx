import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { BranchManager } from "@/components/branches/branch-manager";

export const instant = false;

export default async function BranchesPage() {
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
      role: true,
    },
  });

  if (!membership) redirect("/setup");

  const context = await requirePermission(
    membership.organizationId,
    "branches:read",
  );

  const canManageBranches =
    context.role === MemberRole.OWNER || context.role === MemberRole.ADMIN;

  const branches = await db.branch.findMany({
    where: canManageBranches
      ? { organizationId: membership.organizationId }
      : {
          organizationId: membership.organizationId,
          id: { in: context.branchIds },
        },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      phone: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <BranchManager branches={branches} canManageBranches={canManageBranches} />
  );
}
