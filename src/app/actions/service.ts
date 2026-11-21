"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { serviceSchema } from "@/lib/validations/service";

type ActionResult = { success: true } | { success: false; error: string };

async function getServiceContext() {
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

async function validateServiceCategory(
  categoryId: string,
  organizationId: string,
) {
  const category = await db.serviceCategory.findFirst({
    where: {
      id: categoryId,
      organizationId,
      isActive: true,
    },
    select: { id: true },
  });

  return category !== null;
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
    return "You do not have permission to manage services.";
  }

  return "Something went wrong. Please try again.";
}

export async function createService(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getServiceContext();
    const parsed = serviceSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid service details.",
      };
    }

    const data = parsed.data;

    const validCategory = await validateServiceCategory(
      data.categoryId,
      organizationId,
    );

    if (!validCategory) {
      return {
        success: false,
        error: "Select an active service category.",
      };
    }

    await db.service.create({
      data: {
        categoryId: data.categoryId,
        organizationId,
        name: data.name,
        description: data.description || null,
        price: data.price,
        durationMins: data.durationMins ? Number(data.durationMins) : null,
      },
    });

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A service with this name already exists.",
      };
    }

    console.error("createService error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateService(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getServiceContext();

    if (
      typeof input !== "object" ||
      input === null ||
      !("id" in input) ||
      typeof input.id !== "string"
    ) {
      return { success: false, error: "Invalid service ID." };
    }

    const id = input.id;
    const parsed = serviceSchema.safeParse(
      Object.fromEntries(Object.entries(input).filter(([key]) => key !== "id")),
    );

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid service details.",
      };
    }

    const data = parsed.data;

    const validCategory = await validateServiceCategory(
      data.categoryId,
      organizationId,
    );

    if (!validCategory) {
      return {
        success: false,
        error: "Select an active service category.",
      };
    }

    const result = await db.service.updateMany({
      where: { id, organizationId },
      data: {
        name: data.name,
        categoryId: data.categoryId,
        description: data.description || null,
        price: data.price,
        durationMins: data.durationMins ? Number(data.durationMins) : null,
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Service not found." };
    }

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A service with this name already exists.",
      };
    }

    console.error("updateService error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function setServiceStatus(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getServiceContext();

    if (typeof input !== "object" || input === null) {
      return { success: false, error: "Invalid service details." };
    }

    const data = input as Record<string, unknown>;
    const id = data.id;
    const isActive = data.isActive;

    if (typeof id !== "string" || typeof isActive !== "boolean") {
      return { success: false, error: "Invalid service details." };
    }

    if (isActive) {
      const service = await db.service.findFirst({
        where: { id, organizationId },
        select: {
          category: {
            select: { isActive: true },
          },
        },
      });

      if (!service) {
        return { success: false, error: "Service not found." };
      }

      if (!service.category.isActive) {
        return {
          success: false,
          error:
            "Activate this service's category before activating the service.",
        };
      }
    }

    const result = await db.service.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });

    if (result.count === 0) {
      return { success: false, error: "Service not found." };
    }

    return { success: true };
  } catch (error) {
    console.error("setServiceStatus error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
