"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { updateOrganizationSettingsSchema } from "@/lib/validations/settings";

export async function updateOrganizationSettings(input: unknown) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: "You must be signed in." };
    }

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

    if (!membership) {
      return { success: false, error: "Organization membership not found." };
    }

    if (!hasPermission(membership.role, "organization:manage")) {
      return {
        success: false,
        error: "You do not have permission to update organization settings.",
      };
    }

    const parsed = updateOrganizationSettingsSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid settings.",
      };
    }

    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: parsed.data.timezone,
      });
    } catch {
      return { success: false, error: "Please select a valid time zone." };
    }

    await db.organization.update({
      where: { id: membership.organizationId },
      data: {
        name: parsed.data.name,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
        defaultTaxRate: parsed.data.defaultTaxRate,
      },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/sales");

    return {
      success: true,
      message: "Organization settings updated successfully.",
    };
  } catch (error) {
    console.error("Update organization settings error:", error);

    return {
      success: false,
      error: "Unable to update settings. Please try again.",
    };
  }
}
