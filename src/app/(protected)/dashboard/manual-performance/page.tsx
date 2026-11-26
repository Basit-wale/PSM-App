import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MemberRole } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getManualPerformanceData } from "@/app/actions/manual-performance";
import { ManualPerformanceManager } from "@/components/manual-performance/manual-performance-manager";

export const instant = false;

export default async function ManualPerformancePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

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

  if (!member) redirect("/setup");

  if (member.role !== MemberRole.OWNER) redirect("/dashboard");

  const data = await getManualPerformanceData();

  return (
    <ManualPerformanceManager branches={data.branches} entries={data.entries} />
  );
}
