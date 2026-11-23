import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/shared/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        select: { name: true },
      },
      branches: {
        where: {
          branch: { status: "ACTIVE" },
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!membership) redirect("/setup");

  const branches =
    membership.role === "OWNER" || membership.role === "ADMIN"
      ? await db.branch.findMany({
          where: {
            organizationId: membership.organizationId,
            status: "ACTIVE",
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            code: true,
          },
        })
      : membership.branches.map((item) => item.branch);

  return (
    <DashboardShell
      role={membership.role}
      organizationName={membership.organization.name}
      branchCount={branches.length}
      userName={session.user.name || "User"}
      userEmail={session.user.email}
    >
      {children}
    </DashboardShell>
  );
}
