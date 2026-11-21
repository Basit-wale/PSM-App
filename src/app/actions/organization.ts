"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationSetupSchema } from "@/lib/validations/organization";

type SetupResult =
  | { success: true; organizationId: string; branchId: string }
  | { success: false; error: string };

function createSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return base || "salon";
}

export async function setupOrganization(input: unknown): Promise<SetupResult> {
  const parsed = organizationSetupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      success: false,
      error: "Please sign in before setting up your salon.",
    };
  }

  const { organizationName, branchName, branchCode, address, phone } =
    parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw<{ locked: number }[]>`
  WITH lock_result AS (
    SELECT pg_advisory_xact_lock(
      hashtextextended(${session.user.id}, 0)
    )
  )
  SELECT 1 AS locked
  FROM lock_result
`;

      const existingMembership = await tx.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (existingMembership) {
        throw new Error("EXISTING_ORGANIZATION");
      }

      const baseSlug = createSlug(organizationName);
      const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
        },
      });

      const branch = await tx.branch.create({
        data: {
          organizationId: organization.id,
          name: branchName,
          code: branchCode.toUpperCase(),
          address: address || null,
          phone: phone || null,
        },
      });

      const member = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: session.user.id,
          role: MemberRole.OWNER,
        },
      });

      await tx.branchMembership.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          memberId: member.id,
        },
      });

      return {
        organizationId: organization.id,
        branchId: branch.id,
      };
    });

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "EXISTING_ORGANIZATION") {
      return {
        success: false,
        error: "You already belong to an organization.",
      };
    }

    console.error("Organization setup failed:", error);

    return {
      success: false,
      error: "Unable to set up your salon. Please try again.",
    };
  }
}
