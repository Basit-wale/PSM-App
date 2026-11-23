"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, requireBranchAccess } from "@/lib/auth-guard";
import { z } from "zod";

const audienceSchema = z.object({
  branchId: z.string().uuid().nullable(),
});

const sendSchema = z.object({
  branchId: z.string().uuid().nullable(),
  message: z.string().trim().min(1).max(1530),
});

async function getSmsContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error("AUTH_REQUIRED");

  const member = await db.organizationMember.findFirst({
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

  if (!member) throw new Error("ORGANIZATION_ACCESS_REQUIRED");

  const context = await requirePermission(
    member.organizationId,
    "campaigns:manage",
  );

  return {
    ...context,
    memberId: member.id,
  };
}

function normalizeNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("234")) return cleaned;
  if (cleaned.startsWith("0")) return `234${cleaned.slice(1)}`;

  return cleaned;
}

async function getEligibleCustomers(
  organizationId: string,
  branchId: string | null,
) {
  return db.customer.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      smsOptIn: true,
      ...(branchId
        ? {
            branches: {
              some: {
                branchId,
                organizationId,
              },
            },
          }
        : {}),
    },
    select: {
      id: true,
      phone: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "AUTH_REQUIRED") {
      return "Please sign in to continue.";
    }

    if (error.message === "ORGANIZATION_ACCESS_REQUIRED") {
      return "You do not have active organization access.";
    }

    if (
      error.message === "You do not have permission to perform this action."
    ) {
      return "You do not have permission to send SMS campaigns.";
    }

    if (error.message === "Branch not found or inactive.") {
      return "The selected branch is unavailable.";
    }

    if (error.message === "You do not have access to this branch.") {
      return "You do not have access to the selected branch.";
    }
  }

  console.error("SMS action failed:", error);
  return "The SMS operation could not be completed.";
}

export async function getSmsAudienceCount(input: unknown) {
  const parsed = audienceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false as const, error: "Invalid branch selection." };
  }

  try {
    const context = await getSmsContext();
    const { branchId } = parsed.data;

    if (branchId) {
      await requireBranchAccess(context, branchId);
    } else if (context.role !== "OWNER" && context.role !== "ADMIN") {
      return {
        success: false as const,
        error: "Select one of your assigned branches.",
      };
    }

    const customers = await getEligibleCustomers(
      context.organizationId,
      branchId,
    );

    const recipients = customers
      .map((customer) => ({
        id: customer.id,
        phone: normalizeNigerianPhone(customer.phone),
      }))
      .filter((customer) => /^234\d{10}$/.test(customer.phone));

    return {
      success: true as const,
      recipientCount: recipients.length,
    };
  } catch (error) {
    return {
      success: false as const,
      error: safeError(error),
    };
  }
}

export async function sendSmsCampaign(input: unknown) {
  const parsed = sendSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid campaign details.",
    };
  }

  try {
    const context = await getSmsContext();
    const { branchId, message } = parsed.data;

    if (branchId) {
      await requireBranchAccess(context, branchId);
    } else if (context.role !== "OWNER" && context.role !== "ADMIN") {
      return {
        success: false as const,
        error: "Select one of your assigned branches.",
      };
    }

    const apiToken = process.env.BULKSMSNIGERIA_API_TOKEN;
    const senderId = process.env.BULKSMSNIGERIA_SENDER_ID;

    if (!apiToken || !senderId) {
      return {
        success: false as const,
        error: "SMS provider credentials are not configured yet.",
      };
    }

    if (senderId.length > 11) {
      return {
        success: false as const,
        error: "Your SMS sender ID must not exceed 11 characters.",
      };
    }

    const customers = await getEligibleCustomers(
      context.organizationId,
      branchId,
    );

    const recipients = customers
      .map((customer) => ({
        customerId: customer.id,
        phone: normalizeNigerianPhone(customer.phone),
      }))
      .filter((customer) => /^234\d{10}$/.test(customer.phone));

    if (recipients.length === 0) {
      return {
        success: false as const,
        error: "There are no eligible customers with valid phone numbers.",
      };
    }

    if (recipients.length > 1000) {
      return {
        success: false as const,
        error:
          "This campaign exceeds the 1,000-recipient limit. Please contact support.",
      };
    }

    const campaign = await db.smsCampaign.create({
      data: {
        organizationId: context.organizationId,
        branchId,
        createdByMemberId: context.memberId,
        message,
        senderId,
        status: "SENDING",
        recipientCount: recipients.length,
        recipients: {
          create: recipients.map((recipient) => ({
            organizationId: context.organizationId,
            customerId: recipient.customerId,
            phone: recipient.phone,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    const isSandbox = process.env.BULKSMSNIGERIA_SANDBOX !== "false";

    const baseUrl = isSandbox
      ? "https://www.bulksmsnigeria.com/api/sandbox/v2"
      : "https://www.bulksmsnigeria.com/api/v2";

    try {
      const response = await fetch(`${baseUrl}/sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from: senderId,
          to: recipients.map((recipient) => recipient.phone).join(","),
          body: message,
          gateway: "direct-refund",
        }),
        signal: AbortSignal.timeout(30000),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.status !== "success") {
        throw new Error(
          result?.message || "The SMS provider rejected the campaign.",
        );
      }

      const providerMessageId =
        result?.data?.message_id ?? result?.data?.id ?? null;

      await db.$transaction([
        db.smsRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            organizationId: context.organizationId,
          },
          data: {
            status: "SENT",
            providerMessageId,
            sentAt: new Date(),
          },
        }),
        db.smsCampaign.update({
          where: {
            id: campaign.id,
          },
          data: {
            status: "SENT",
            providerMessageId,
            sentCount: recipients.length,
          },
        }),
      ]);

      return {
        success: true as const,
        campaignId: campaign.id,
        recipientCount: recipients.length,
        sandbox: isSandbox,
      };
    } catch (providerError) {
      await db.$transaction([
        db.smsRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            organizationId: context.organizationId,
          },
          data: {
            status: "FAILED",
            errorMessage:
              providerError instanceof Error
                ? providerError.message.slice(0, 500)
                : "SMS provider request failed.",
          },
        }),
        db.smsCampaign.update({
          where: {
            id: campaign.id,
          },
          data: {
            status: "FAILED",
            failedCount: recipients.length,
          },
        }),
      ]);

      throw providerError;
    }
  } catch (error) {
    return {
      success: false as const,
      error: safeError(error),
    };
  }
}

export async function getSmsCampaignHistory() {
  try {
    const context = await getSmsContext();

    const campaigns = await db.smsCampaign.findMany({
      where: {
        organizationId: context.organizationId,
        ...(context.role === "OWNER" || context.role === "ADMIN"
          ? {}
          : {
              branchId: {
                in: context.branchIds,
              },
            }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
      select: {
        id: true,
        message: true,
        senderId: true,
        status: true,
        recipientCount: true,
        sentCount: true,
        deliveredCount: true,
        failedCount: true,
        createdAt: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      success: true as const,
      campaigns,
    };
  } catch (error) {
    return {
      success: false as const,
      error: safeError(error),
    };
  }
}
