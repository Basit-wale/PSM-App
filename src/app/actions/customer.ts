"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireBranchPermission } from "@/lib/auth-guard";
import { createCustomerSchema } from "@/lib/validations/customer";
import { z } from "zod";
import { requirePermission, requireBranchAccess } from "@/lib/auth-guard";

type ActionResult =
  | {
      success: true;
      customerId: string;
      existingCustomer: boolean;
      requiresConfirmation?: false;
    }
  | {
      success: true;
      existingCustomer: true;
      requiresConfirmation: true;
      existingCustomerName: string;
    }
  | {
      success: false;
      error: string;
    };

const createCustomerInputSchema = z.object({
  branchId: z.string().uuid("Invalid branch."),
  customer: createCustomerSchema,
  confirmExisting: z.boolean().optional().default(false),
});

const updateCustomerInputSchema = z.object({
  customerId: z.string().uuid("Invalid customer."),
  branchId: z.string().uuid("Invalid branch."),
  customer: createCustomerSchema,
});

async function getCustomerManagementContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("AUTH_REQUIRED");
  }

  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!member) {
    throw new Error("ORGANIZATION_ACCESS_REQUIRED");
  }

  return member;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s()-]/g, "");
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      AUTH_REQUIRED: "Please sign in to continue.",
      ORGANIZATION_ACCESS_REQUIRED:
        "You do not have active organization access.",
      "You do not have permission to perform this action.":
        "You do not have permission to manage customers.",
      "Branch not found or inactive.": "The selected branch is unavailable.",
      CUSTOMER_NOT_FOUND: "Customer not found in this branch.",
    };

    if (messages[error.message]) {
      return messages[error.message];
    }
  }

  console.error("Customer action failed:", error);

  return "The operation could not be completed. Please try again.";
}

export async function createCustomer(input: unknown): Promise<ActionResult> {
  const parsed = createCustomerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid customer details.",
    };
  }

  try {
    const context = await getCustomerManagementContext();

    const { branchId, customer, confirmExisting } = parsed.data;

    await requireBranchPermission(
      context.organizationId,
      branchId,
      "customers:manage",
    );

    const phone = normalizePhone(customer.phone);

    return await db.$transaction(async (tx) => {
      // Prevent simultaneous creation or merging of the same phone number.
      await tx.$queryRaw<{ locked: number }[]>`
        WITH lock_result AS (
          SELECT pg_advisory_xact_lock(
            hashtextextended(
              ${context.organizationId + ":" + phone},
              3
            )
          )
        )
        SELECT 1 AS locked
        FROM lock_result
      `;

      const existing = await tx.customer.findUnique({
        where: {
          organizationId_phone: {
            organizationId: context.organizationId,
            phone,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      if (existing) {
        // First request only detects the duplicate. It changes nothing.
        if (!confirmExisting) {
          return {
            success: true,
            existingCustomer: true,
            requiresConfirmation: true,
            existingCustomerName:
              `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
          };
        }

        // Update the existing shared customer profile only after confirmation.
        await tx.customer.update({
          where: {
            id: existing.id,
          },
          data: {
            firstName: customer.firstName,
            lastName: customer.lastName || null,
            phone,
            email: customer.email || null,
            dateOfBirth: customer.dateOfBirth
              ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
              : null,
            whatsappOptIn: customer.whatsappOptIn,
            smsOptIn: customer.smsOptIn,
            notes: customer.notes || null,
          },
        });

        // Preserve existing branch links and add the selected branch.
        await tx.customerBranch.upsert({
          where: {
            customerId_branchId: {
              customerId: existing.id,
              branchId,
            },
          },
          create: {
            organizationId: context.organizationId,
            customerId: existing.id,
            branchId,
          },
          update: {},
        });

        return {
          success: true,
          customerId: existing.id,
          existingCustomer: true,
        };
      }

      const created = await tx.customer.create({
        data: {
          organizationId: context.organizationId,
          firstName: customer.firstName,
          lastName: customer.lastName || null,
          phone,
          email: customer.email || null,
          dateOfBirth: customer.dateOfBirth
            ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
            : null,
          whatsappOptIn: customer.whatsappOptIn,
          smsOptIn: customer.smsOptIn,
          notes: customer.notes || null,
          branches: {
            create: {
              branch: {
                connect: {
                  id_organizationId: {
                    id: branchId,
                    organizationId: context.organizationId,
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      return {
        success: true,
        customerId: created.id,
        existingCustomer: false,
      };
    });
  } catch (error) {
    return {
      success: false,
      error: getSafeErrorMessage(error),
    };
  }
}

export async function updateCustomer(input: unknown): Promise<ActionResult> {
  const parsed = updateCustomerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid customer details.",
    };
  }

  try {
    const context = await getCustomerManagementContext();

    const { customerId, branchId, customer } = parsed.data;

    await requireBranchPermission(
      context.organizationId,
      branchId,
      "customers:manage",
    );

    const result = await db.customer.updateMany({
      where: {
        id: customerId,
        organizationId: context.organizationId,
        branches: {
          some: {
            branchId,
            organizationId: context.organizationId,
          },
        },
      },
      data: {
        firstName: customer.firstName,
        lastName: customer.lastName || null,
        phone: normalizePhone(customer.phone),
        email: customer.email || null,
        dateOfBirth: customer.dateOfBirth
          ? new Date(`${customer.dateOfBirth}T00:00:00.000Z`)
          : null,
        whatsappOptIn: customer.whatsappOptIn,
        smsOptIn: customer.smsOptIn,
        notes: customer.notes || null,
      },
    });

    if (result.count === 0) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    return {
      success: true,
      customerId,
      existingCustomer: true,
    };
  } catch (error) {
    const isUniqueConstraint =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002";

    return {
      success: false,
      error: isUniqueConstraint
        ? "Another customer already uses this phone number."
        : getSafeErrorMessage(error),
    };
  }
}

const smsBroadcastInputSchema = z.object({
  branchId: z.string().uuid().nullable(),
  message: z.string().trim().min(1, "Enter an SMS message.").max(1530),
});

type SmsBroadcastResult =
  | {
      success: true;
      campaignId: string;
      recipientCount: number;
    }
  | {
      success: false;
      error: string;
    };

function normalizeSmsPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    digits = `234${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `234${digits}`;
  }

  return /^234\d{10}$/.test(digits) ? digits : null;
}

async function getEligibleSmsRecipients(
  organizationId: string,
  branchId: string | null,
) {
  const customers = await db.customer.findMany({
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
  });

  const uniqueRecipients = new Map<
    string,
    { customerId: string; phone: string }
  >();

  for (const customer of customers) {
    const phone = normalizeSmsPhone(customer.phone);

    if (phone && !uniqueRecipients.has(phone)) {
      uniqueRecipients.set(phone, {
        customerId: customer.id,
        phone,
      });
    }
  }

  return Array.from(uniqueRecipients.values());
}

export async function getSmsBroadcastRecipientCount(
  branchId: string | null,
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const member = await getCustomerManagementContext();

    const context = await requirePermission(
      member.organizationId,
      "campaigns:manage",
    );

    if (branchId) {
      await requireBranchAccess(context, branchId);
    } else if (context.role !== "OWNER" && context.role !== "ADMIN") {
      return {
        success: false,
        count: 0,
        error: "Select one of your assigned branches.",
      };
    }

    const recipients = await getEligibleSmsRecipients(
      context.organizationId,
      branchId,
    );

    return {
      success: true,
      count: recipients.length,
    };
  } catch (error) {
    console.error("SMS recipient count failed:", error);

    return {
      success: false,
      count: 0,
      error:
        error instanceof Error &&
        error.message === "You do not have permission to perform this action."
          ? "You do not have permission to manage SMS campaigns."
          : "Unable to calculate the SMS recipient count.",
    };
  }
}

export async function sendSmsBroadcast(
  input: unknown,
): Promise<SmsBroadcastResult> {
  const parsed = smsBroadcastInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid SMS details.",
    };
  }

  const apiToken = process.env.BULKSMSNIGERIA_API_TOKEN;
  const senderId = process.env.BULKSMSNIGERIA_SENDER_ID;
  const sandbox = process.env.BULKSMSNIGERIA_SANDBOX !== "false";

  if (!apiToken || !senderId) {
    return {
      success: false,
      error: "SMS provider credentials have not been configured.",
    };
  }

  if (senderId.length > 11) {
    return {
      success: false,
      error: "The SMS sender ID cannot exceed 11 characters.",
    };
  }

  let campaignId: string | null = null;

  try {
    const member = await getCustomerManagementContext();

    const context = await requirePermission(
      member.organizationId,
      "campaigns:manage",
    );

    const { branchId, message } = parsed.data;

    if (branchId) {
      await requireBranchAccess(context, branchId);
    } else if (context.role !== "OWNER" && context.role !== "ADMIN") {
      throw new Error("Select one of your assigned branches.");
    }

    const recipients = await getEligibleSmsRecipients(
      context.organizationId,
      branchId,
    );

    if (recipients.length === 0) {
      throw new Error(
        "There are no eligible SMS subscribers in this selection.",
      );
    }

    if (recipients.length > 10000) {
      throw new Error("This campaign exceeds the 10,000-recipient limit.");
    }

    campaignId = await db.$transaction(async (tx) => {
      const campaign = await tx.smsCampaign.create({
        data: {
          organizationId: context.organizationId,
          branchId,
          createdByMemberId: context.memberId,
          message,
          senderId,
          status: "SENDING",
          recipientCount: recipients.length,
        },
        select: {
          id: true,
        },
      });

      await tx.smsRecipient.createMany({
        data: recipients.map((recipient) => ({
          organizationId: context.organizationId,
          campaignId: campaign.id,
          customerId: recipient.customerId,
          phone: recipient.phone,
          status: "PENDING" as const,
        })),
      });

      return campaign.id;
    });

    const baseUrl = sandbox
      ? "https://www.bulksmsnigeria.com/api/sandbox/v2"
      : "https://www.bulksmsnigeria.com/api/v2";

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
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as {
      status?: string;
      message?: string;
      data?: {
        id?: string;
        message_id?: string;
      };
      message_id?: string;
    } | null;

    if (!response.ok || result?.status === "error") {
      throw new Error(
        result?.message || "The SMS provider rejected the campaign.",
      );
    }

    const providerMessageId =
      result?.data?.message_id ||
      result?.data?.id ||
      result?.message_id ||
      null;

    await db.$transaction([
      db.smsRecipient.updateMany({
        where: {
          campaignId,
          organizationId: context.organizationId,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId,
        },
      }),
      db.smsCampaign.update({
        where: {
          id: campaignId,
        },
        data: {
          status: "SENT",
          sentCount: recipients.length,
          providerMessageId,
        },
      }),
    ]);

    return {
      success: true,
      campaignId,
      recipientCount: recipients.length,
    };
  } catch (error) {
    console.error("SMS broadcast failed:", error);

    if (campaignId) {
      try {
        await db.$transaction([
          db.smsRecipient.updateMany({
            where: { campaignId },
            data: {
              status: "FAILED",
              errorMessage: "SMS provider rejected or failed the request.",
            },
          }),
          db.smsCampaign.update({
            where: { id: campaignId },
            data: {
              status: "FAILED",
              failedCount: await db.smsRecipient.count({
                where: { campaignId },
              }),
            },
          }),
        ]);
      } catch (updateError) {
        console.error("SMS campaign status update failed:", updateError);
      }
    }

    const message = error instanceof Error ? error.message : "";

    return {
      success: false,
      error:
        message === "You do not have permission to perform this action."
          ? "You do not have permission to manage SMS campaigns."
          : message === "AUTH_REQUIRED"
            ? "Please sign in to continue."
            : message === "ORGANIZATION_ACCESS_REQUIRED"
              ? "You do not have active organization access."
              : message || "The SMS campaign could not be sent.",
    };
  }
}
