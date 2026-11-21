import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
    <div className="flex min-h-screen bg-[#F7F6F1] text-[#343B35]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-[#E5E6DF] bg-[#F1F2EC]">
        <div className="flex h-[68px] items-center border-b border-[#E5E6DF] px-5">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.07em] text-[#46594B]">
              SALON MANAGER
            </p>
            <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-[#92998F]">
              Business management
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6">
          <DashboardNavigation />
        </div>

        <div className="border-t border-[#E5E6DF] px-5 py-4">
          <p className="truncate text-[12px] font-medium text-[#465047]">
            {membership.organization.name}
          </p>
          <p className="mt-1 text-[10px] text-[#858D84]">
            {branches.length} active{" "}
            {branches.length === 1 ? "branch" : "branches"}
          </p>
        </div>
      </aside>

      <div className="ml-60 flex min-w-0 min-h-screen flex-1 flex-col">
        <header className="flex min-h-[68px] items-center justify-between gap-4 border-b border-[#E8E8E1] bg-[#FBFAF7] px-7 py-3">
          <div>
            <p className="text-[13px] font-medium text-[#465047]">
              {membership.organization.name}
            </p>
            <p className="mt-0.5 text-[10px] text-[#92998F]">
              {branches.length} active{" "}
              {branches.length === 1 ? "branch" : "branches"}
            </p>
          </div>

          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#858D84]">
            {membership.role.replaceAll("_", " ")}
          </p>
        </header>

        <main className="min-w-0 flex-1 bg-[#F7F6F1] p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
