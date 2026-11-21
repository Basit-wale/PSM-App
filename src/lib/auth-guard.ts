import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/permissions";
import { MemberRole } from "@/generated/prisma/client";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export type AuthContext = {
  userId: string;
  organizationId: string;
  memberId: string;
  role: MemberRole;
  branchIds: string[];
};

const ORGANIZATION_WIDE_ROLES: MemberRole[] = [
  MemberRole.OWNER,
  MemberRole.ADMIN,
];

/**
 * Gets the signed-in user and verifies active membership
 * in the requested organization.
 */
export async function requireAuthContext(
  organizationId: string,
): Promise<AuthContext> {
  if (!organizationId) {
    throw new AuthorizationError("Organization ID is required.", 400);
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new AuthorizationError("Authentication required.", 401);
  }

  const member = await db.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    include: {
      branches: {
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!member || !member.isActive) {
    throw new AuthorizationError(
      "You do not have active access to this organization.",
      403,
    );
  }

  return {
    userId: session.user.id,
    organizationId: member.organizationId,
    memberId: member.id,
    role: member.role,
    branchIds: member.branches.map((branch) => branch.branchId),
  };
}

/**
 * Verifies that the current member has a specific permission.
 */
export async function requirePermission(
  organizationId: string,
  permission: Permission,
): Promise<AuthContext> {
  const context = await requireAuthContext(organizationId);

  if (!hasPermission(context.role, permission)) {
    throw new AuthorizationError(
      "You do not have permission to perform this action.",
      403,
    );
  }

  return context;
}

/**
 * Verifies that a branch belongs to the organization,
 * is active, and is accessible to the current member.
 */
export async function requireBranchAccess(
  context: AuthContext,
  branchId: string,
): Promise<AuthContext> {
  if (!branchId) {
    throw new AuthorizationError("Branch ID is required.", 400);
  }

  const branch = await db.branch.findFirst({
    where: {
      id: branchId,
      organizationId: context.organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (!branch) {
    throw new AuthorizationError("Branch not found or inactive.", 404);
  }

  const hasOrganizationWideAccess = ORGANIZATION_WIDE_ROLES.includes(
    context.role,
  );

  if (!hasOrganizationWideAccess && !context.branchIds.includes(branchId)) {
    throw new AuthorizationError("You do not have access to this branch.", 403);
  }

  return context;
}

/**
 * Verifies authentication, permission, and branch access
 * before a branch-specific operation.
 */
export async function requireBranchPermission(
  organizationId: string,
  branchId: string,
  permission: Permission,
): Promise<AuthContext> {
  const context = await requirePermission(organizationId, permission);

  return requireBranchAccess(context, branchId);
}

export function isAuthorizationError(
  error: unknown,
  statusCode?: number,
): error is AuthorizationError {
  return (
    error instanceof AuthorizationError &&
    (statusCode === undefined || error.statusCode === statusCode)
  );
}

export function handleAuthorizationError(error: unknown): never {
  if (error instanceof AuthorizationError) {
    if (error.statusCode === 401) {
      throw new Error("AUTHENTICATION_REQUIRED");
    }

    if (error.statusCode === 403) {
      throw new Error("ACCESS_DENIED");
    }

    if (error.statusCode === 404) {
      throw new Error("RESOURCE_NOT_FOUND");
    }
  }

  throw error;
}
