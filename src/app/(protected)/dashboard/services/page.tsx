import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/shared/access-denied";
import { ServiceManager } from "@/components/services/service-manager";

export const instant = false;

export default async function ServicesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    select: {
      organizationId: true,
      role: true,
    },
  });

  if (!member) {
    redirect("/setup");
  }

  try {
    await requirePermission(member.organizationId, "services:read");
  } catch {
    return <AccessDenied />;
  }

  const [services, categories] = await Promise.all([
    db.service.findMany({
      where: {
        organizationId: member.organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        price: true,
        durationMins: true,
        isActive: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    db.serviceCategory.findMany({
      where: {
        organizationId: member.organizationId,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    }),
  ]);

  const serviceRecords = services.map((service) => ({
    ...service,
    price: service.price.toString(),
  }));

  return (
    <ServiceManager
      services={serviceRecords}
      categories={categories}
      canManageServices={hasPermission(member.role, "services:manage")}
    />
  );
}
