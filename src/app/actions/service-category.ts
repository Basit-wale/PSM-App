"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { serviceCategorySchema } from "@/lib/validations/service-category";

type ActionResult = { success: true } | { success: false; error: string };

async function getCategoryContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Authentication required.");
  }

  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: { organizationId: true },
  });

  if (!member) {
    throw new Error("No active organization found.");
  }

  await requirePermission(member.organizationId, "services:manage");

  return member.organizationId;
}

function isDuplicateError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Authentication required.") {
    return "Please sign in again.";
  }

  if (
    error instanceof Error &&
    error.message === "No active organization found."
  ) {
    return error.message;
  }

  if (error instanceof Error && error.message.includes("permission")) {
    return "You do not have permission to manage service categories.";
  }

  return "Something went wrong. Please try again.";
}

export async function createServiceCategory(
  input: unknown,
): Promise<ActionResult> {
  try {
    const organizationId = await getCategoryContext();
    const parsed = serviceCategorySchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid category details.",
      };
    }

    await db.serviceCategory.create({
      data: {
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A category with this name already exists.",
      };
    }

    console.error("createServiceCategory error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateServiceCategory(
  input: unknown,
): Promise<ActionResult> {
  try {
    const organizationId = await getCategoryContext();

    if (
      typeof input !== "object" ||
      input === null ||
      !("id" in input) ||
      typeof input.id !== "string"
    ) {
      return { success: false, error: "Invalid category ID." };
    }

    const id = input.id;
    const parsed = serviceCategorySchema.safeParse(
      Object.fromEntries(Object.entries(input).filter(([key]) => key !== "id")),
    );

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid category details.",
      };
    }

    const result = await db.serviceCategory.updateMany({
      where: { id, organizationId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Category not found." };
    }

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A category with this name already exists.",
      };
    }

    console.error("updateServiceCategory error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function setServiceCategoryStatus(input: {
  id: string;
  isActive: boolean;
}): Promise<ActionResult> {
  try {
    const organizationId = await getCategoryContext();

    if (
      !input ||
      typeof input.id !== "string" ||
      typeof input.isActive !== "boolean"
    ) {
      return { success: false, error: "Invalid category details." };
    }

    if (!input.isActive) {
      const activeServices = await db.service.count({
        where: {
          organizationId,
          categoryId: input.id,
          isActive: true,
        },
      });

      if (activeServices > 0) {
        return {
          success: false,
          error:
            "Deactivate or move all active services in this category before deactivating the category.",
        };
      }
    }

    const result = await db.serviceCategory.updateMany({
      where: {
        id: input.id,
        organizationId,
      },
      data: {
        isActive: input.isActive,
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Category not found." };
    }

    return { success: true };
  } catch (error) {
    console.error("setServiceCategoryStatus error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
