"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { productSchema } from "@/lib/validations/product";

type ActionResult = { success: true } | { success: false; error: string };

async function getProductContext() {
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

  await requirePermission(member.organizationId, "products:manage");

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

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("permission")
  ) {
    return "You do not have permission to manage products.";
  }

  return "Something went wrong. Please try again.";
}

export async function createProduct(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getProductContext();
    const parsed = productSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product details.",
      };
    }

    const data = parsed.data;

    await db.product.create({
      data: {
        organizationId,
        name: data.name,
        sku: data.sku.toUpperCase(),
        description: data.description || null,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
      },
    });

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A product with this SKU already exists.",
      };
    }

    console.error("createProduct error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateProduct(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getProductContext();

    if (typeof input !== "object" || input === null) {
      return { success: false, error: "Invalid product details." };
    }

    const data = input as Record<string, unknown>;
    const id = data.id;

    if (typeof id !== "string") {
      return { success: false, error: "Invalid product ID." };
    }

    const parsed = productSchema.safeParse({
      name: data.name,
      sku: data.sku,
      description: data.description,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product details.",
      };
    }

    const product = parsed.data;

    const result = await db.product.updateMany({
      where: { id, organizationId },
      data: {
        name: product.name,
        sku: product.sku.toUpperCase(),
        description: product.description || null,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Product not found." };
    }

    return { success: true };
  } catch (error) {
    if (isDuplicateError(error)) {
      return {
        success: false,
        error: "A product with this SKU already exists.",
      };
    }

    console.error("updateProduct error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function setProductStatus(input: unknown): Promise<ActionResult> {
  try {
    const organizationId = await getProductContext();

    if (typeof input !== "object" || input === null) {
      return { success: false, error: "Invalid product details." };
    }

    const data = input as Record<string, unknown>;
    const id = data.id;
    const status = data.status;

    if (
      typeof id !== "string" ||
      (status !== "ACTIVE" && status !== "INACTIVE")
    ) {
      return { success: false, error: "Invalid product details." };
    }

    const result = await db.product.updateMany({
      where: { id, organizationId },
      data: { status },
    });

    if (result.count === 0) {
      return { success: false, error: "Product not found." };
    }

    return { success: true };
  } catch (error) {
    console.error("setProductStatus error:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
