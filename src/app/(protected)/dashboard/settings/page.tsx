import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { SettingsManager } from "@/components/settings/settings-manager";

export const instant = false;

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    include: {
      organization: {
        select: {
          name: true,
          slug: true,
          currency: true,
          timezone: true,
          defaultTaxRate: true,
        },
      },
    },
  });

  if (!membership) redirect("/setup");

  if (!hasPermission(membership.role, "organization:read")) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-3 text-sm text-red-600">
          You do not have permission to view organization settings.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Manage your salon organization and business preferences.
          </p>
        </div>

        <SettingsManager
          initialSettings={{
            name: membership.organization.name,
            slug: membership.organization.slug,
            currency: membership.organization.currency,
            timezone: membership.organization.timezone,
            defaultTaxRate: membership.organization.defaultTaxRate.toString(),
          }}
          canManage={hasPermission(membership.role, "organization:manage")}
        />
      </div>
    </main>
  );
}
