import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";

export const instant = false;

function formatAmount(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-[#E3E4DC] bg-[#FBFAF7] p-5 transition-colors hover:border-[#D1D9CF]">
      <p className="text-[12px] font-medium tracking-wide text-[#858D84]">
        {label}
      </p>
      <p className="mt-2 text-[25px] font-semibold tracking-tight text-[#39443B]">
        {value}
      </p>
      {description && (
        <p className="mt-1.5 text-[11px] leading-4 text-[#90968D]">
          {description}
        </p>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#39443B]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[11px] text-[#858D84]">{description}</p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const membership = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    include: {
      organization: {
        select: {
          name: true,
        },
      },
      branches: {
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!membership) {
    redirect("/setup");
  }

  const organizationId = membership.organizationId;
  const role = membership.role;
  const branchIds = membership.branches.map((branch) => branch.branchId);

  const hasOrganizationWideAccess = role === "OWNER" || role === "ADMIN";

  const branchFilter = hasOrganizationWideAccess
    ? {}
    : { branchId: { in: branchIds } };

  const canViewSales =
    hasPermission(role, "sales:read") && hasPermission(role, "payments:read");

  const canViewAppointments = hasPermission(role, "appointments:read");
  const canViewExpenses = hasPermission(role, "expenses:read");
  const canViewInventory = hasPermission(role, "inventory:read");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [
    todayRevenue,
    monthRevenue,
    weeklyPayments,
    weeklyAppointments,
    recentSales,
    todayAppointments,
    pendingExpenses,
    outOfStockProducts,
  ] = await Promise.all([
    // Today's revenue
    canViewSales
      ? db.payment.aggregate({
          where: {
            organizationId,
            status: "COMPLETED",
            paidAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
            sale: branchFilter,
          },
          _sum: {
            amount: true,
          },
        })
      : Promise.resolve(null),

    // Monthly revenue
    canViewSales
      ? db.payment.aggregate({
          where: {
            organizationId,
            status: "COMPLETED",
            paidAt: {
              gte: monthStart,
              lt: tomorrowStart,
            },
            sale: branchFilter,
          },
          _sum: {
            amount: true,
          },
        })
      : Promise.resolve(null),

    // Last 7 days of payments
    canViewSales
      ? db.payment.findMany({
          where: {
            organizationId,
            status: "COMPLETED",
            paidAt: {
              gte: weekStart,
              lt: tomorrowStart,
            },
            sale: branchFilter,
          },
          select: {
            amount: true,
            paidAt: true,
          },
        })
      : Promise.resolve([]),

    // Last 7 days of appointments
    canViewAppointments
      ? db.appointment.findMany({
          where: {
            organizationId,
            ...branchFilter,
            startsAt: {
              gte: weekStart,
              lt: tomorrowStart,
            },
          },
          select: {
            startsAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),

    // Recent sales
    canViewSales
      ? db.sale.findMany({
          where: {
            organizationId,
            ...branchFilter,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            receiptNumber: true,
            total: true,
            status: true,
            createdAt: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),

    // Today's appointments
    canViewAppointments
      ? db.appointment.findMany({
          where: {
            organizationId,
            ...branchFilter,
            startsAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
          select: {
            status: true,
          },
        })
      : Promise.resolve([]),

    // Pending expenses
    canViewExpenses
      ? db.expense.aggregate({
          where: {
            organizationId,
            ...branchFilter,
            status: "PENDING",
          },
          _count: {
            id: true,
          },
          _sum: {
            amount: true,
          },
        })
      : Promise.resolve(null),

    // Out-of-stock products
    canViewInventory
      ? db.inventoryBalance.findMany({
          where: {
            organizationId,
            ...branchFilter,
            quantity: {
              lte: 0,
            },
            product: {
              status: "ACTIVE",
            },
          },
          select: {
            id: true,
            quantity: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            branch: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const weeklyAppointmentCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);

    const dayStart = new Date(date);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const appointments = weeklyAppointments.filter(
      (appointment) =>
        appointment.startsAt >= dayStart && appointment.startsAt < nextDay,
    );

    return {
      label: date.toLocaleDateString(undefined, {
        weekday: "short",
      }),
      count: appointments.length,
    };
  });

  const weeklyAppointmentMax = Math.max(
    ...weeklyAppointmentCounts.map((day) => day.count),
    1,
  );

  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);

    const dayStart = new Date(date);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const amount = weeklyPayments
      .filter(
        (payment) =>
          payment.paidAt !== null &&
          payment.paidAt >= dayStart &&
          payment.paidAt < nextDay,
      )
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    return {
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      amount,
    };
  });

  const weeklyMax = Math.max(...weeklyRevenue.map((day) => day.amount), 1);

  const bestRevenueDay = weeklyRevenue.reduce(
    (best, day) => (day.amount > best.amount ? day : best),
    weeklyRevenue[0],
  );

  const appointmentCounts = {
    total: todayAppointments.length,
    pending: todayAppointments.filter(
      (appointment) => appointment.status === "PENDING",
    ).length,
    confirmed: todayAppointments.filter(
      (appointment) => appointment.status === "CONFIRMED",
    ).length,
    inProgress: todayAppointments.filter(
      (appointment) => appointment.status === "IN_PROGRESS",
    ).length,
    completed: todayAppointments.filter(
      (appointment) => appointment.status === "COMPLETED",
    ).length,
  };

  const pendingExpenseCount = pendingExpenses?._count.id ?? 0;
  const pendingExpenseAmount = pendingExpenses?._sum.amount ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-[#849084]">
            Business overview
          </p>
          <h1 className="mt-1.5 text-[23px] font-semibold tracking-tight text-[#354137]">
            {membership.organization.name}
          </h1>
          <p className="mt-1 text-[12px] text-[#858D84]">
            Here's an overview of your salon's activity.
          </p>
        </div>

        <div className="rounded-lg border border-[#E2E5DC] bg-[#F1F2EC] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[#858D84]">
            Your role
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-[#526957]">
            {role.replaceAll("_", " ")}
          </p>
          {!hasOrganizationWideAccess && (
            <p className="mt-0.5 text-[10px] text-[#858D84]">
              Assigned branches only
            </p>
          )}
        </div>
      </div>

      {/* Overview cards */}
      {(canViewSales ||
        canViewAppointments ||
        canViewExpenses ||
        canViewInventory) && (
        <section>
          <SectionHeading
            title="Overview"
            description="A quick look at your business performance"
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canViewSales && (
              <>
                <StatCard
                  label="Today's Revenue"
                  value={formatAmount(todayRevenue?._sum.amount)}
                  description="Completed payments today"
                />
                <StatCard
                  label="Monthly Revenue"
                  value={formatAmount(monthRevenue?._sum.amount)}
                  description="Completed payments this month"
                />
              </>
            )}

            {canViewAppointments && (
              <StatCard
                label="Today's Appointments"
                value={appointmentCounts.total}
                description={`${appointmentCounts.pending} pending · ${appointmentCounts.confirmed} confirmed`}
              />
            )}

            {canViewExpenses && (
              <StatCard
                label="Pending Expenses"
                value={pendingExpenseCount}
                description={formatAmount(pendingExpenseAmount)}
              />
            )}

            {canViewInventory && (
              <StatCard
                label="Out of Stock"
                value={outOfStockProducts.length}
                description="Active products with zero stock (up to 5 shown below)"
              />
            )}
          </div>
        </section>
      )}

      {/* Weekly business performance */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-1">
        {/* Weekly revenue chart */}
        {canViewSales && (
          <section className="rounded-xl border border-[#E3E4DC] bg-[#FBFAF7] p-5">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                title="Revenue Overview"
                description="Daily completed payments over the last 7 days"
              />

              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#858D84]">
                  7-day revenue
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#465047]">
                  {formatAmount(
                    weeklyRevenue.reduce((sum, day) => sum + day.amount, 0),
                  )}
                </p>
                <p className="mt-1 text-[10px] text-[#858D84]">
                  Best day:{" "}
                  <span className="font-semibold text-[#617968]">
                    {bestRevenueDay.amount > 0
                      ? bestRevenueDay.label
                      : "No revenue yet"}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid h-44 grid-cols-7 gap-3">
              {weeklyRevenue.map((day) => (
                <div
                  key={day.label}
                  className="flex min-w-0 flex-col items-center justify-end"
                >
                  <p className="mb-2 text-center text-[9px] font-medium tabular-nums text-[#858D84]">
                    {day.amount > 0 ? formatAmount(day.amount) : "—"}
                  </p>

                  <div className="flex h-28 w-full items-end justify-center rounded-t-md bg-[#F0F1EB]">
                    <div
                      className="w-full max-w-10 rounded-t-md bg-[#819582] transition-all duration-300"
                      style={{
                        height:
                          day.amount > 0
                            ? `${Math.max((day.amount / weeklyMax) * 100, 5)}%`
                            : "0%",
                      }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] font-medium text-[#687168]">
                    {day.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Weekly appointments chart */}
        {/*{canViewAppointments && (
          <section className="rounded-xl border border-[#E3E4DC] bg-[#FBFAF7] p-5">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                title="Appointment Activity"
                description="Daily appointments over the last 7 days"
              />

              <div className="text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#858D84]">
                  7-day appointments
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#465047]">
                  {weeklyAppointmentCounts.reduce(
                    (sum, day) => sum + day.count,
                    0,
                  )}
                </p>
              </div>
            </div>

            <div className="grid h-44 grid-cols-7 gap-3">
              {weeklyAppointmentCounts.map((day) => (
                <div
                  key={day.label}
                  className="flex min-w-0 flex-col items-center justify-end"
                >
                  <p className="mb-2 text-center text-[10px] font-semibold tabular-nums text-[#687168]">
                    {day.count}
                  </p>

                  <div className="flex h-28 w-full items-end justify-center rounded-t-md bg-[#F0F1EB]">
                    <div
                      className="w-full max-w-10 rounded-t-md bg-[#8295AA] transition-all duration-300"
                      style={{
                        height:
                          day.count > 0
                            ? `${Math.max(
                                (day.count / weeklyAppointmentMax) * 100,
                                5,
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>

                  <p className="mt-2 text-[10px] font-medium text-[#687168]">
                    {day.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}*/}
      </div>

      {/* Appointment summary */}
      {canViewAppointments && (
        <section className="rounded-xl border border-[#E3E4DC] bg-[#FBFAF7] p-5">
          <SectionHeading
            title="Today's Appointments"
            description="Appointment status breakdown for today"
          />

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              {
                label: "Pending",
                value: appointmentCounts.pending,
                color: "bg-[#C49A57]",
                text: "text-[#A27D43]",
              },
              {
                label: "Confirmed",
                value: appointmentCounts.confirmed,
                color: "bg-[#819582]",
                text: "text-[#617968]",
              },
              {
                label: "In progress",
                value: appointmentCounts.inProgress,
                color: "bg-[#8295AA]",
                text: "text-[#687B91]",
              },
              {
                label: "Completed",
                value: appointmentCounts.completed,
                color: "bg-[#6F9875]",
                text: "text-[#56805C]",
              },
            ].map((item) => {
              const percentage =
                appointmentCounts.total > 0
                  ? (item.value / appointmentCounts.total) * 100
                  : 0;

              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-[#858D84]">
                      {item.label}
                    </p>
                    <p
                      className={`text-lg font-semibold tabular-nums ${item.text}`}
                    >
                      {item.value}
                    </p>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECEDE6]">
                    <div
                      className={`h-full rounded-full transition-all ${item.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[#E7E7DF] pt-4">
            <p className="text-[11px] text-[#858D84]">
              Total appointments today
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[#465047]">
              {appointmentCounts.total}
            </p>
          </div>
        </section>
      )}

      {/* Recent sales */}
      {canViewSales && (
        <section className="overflow-hidden rounded-xl border border-[#E3E4DC] bg-[#FBFAF7]">
          <div className="px-5 pt-5">
            <SectionHeading
              title="Recent Sales"
              description="The latest sales recorded in your business"
            />
          </div>

          {recentSales.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-[#858D84]">
              No sales recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="border-y border-[#E7E7DF] bg-[#F3F3EE]">
                    <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#858D84]">
                      Receipt
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#858D84]">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#858D84]">
                      Date
                    </th>
                    <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[#858D84]">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[#858D84]">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="border-b border-[#EEEEEA] transition-colors last:border-0 hover:bg-[#F6F6F1]"
                    >
                      <td className="px-5 py-3.5 text-[12px] font-medium text-[#465047]">
                        {sale.receiptNumber}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-[#687168]">
                        {sale.branch.name}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-[#687168]">
                        {sale.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge>{sale.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-[12px] font-semibold tabular-nums text-[#39443B]">
                        {formatAmount(sale.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Out of stock */}
      {canViewInventory && (
        <section className="overflow-hidden rounded-xl border border-[#E3E4DC] bg-[#FBFAF7]">
          <div className="px-5 pt-5">
            <SectionHeading
              title="Out-of-Stock Products"
              description="Active products that currently need restocking"
            />
          </div>

          {outOfStockProducts.length === 0 ? (
            <p className="px-5 pb-5 text-[12px] text-[#858D84]">
              No active products are currently out of stock.
            </p>
          ) : (
            <div className="divide-y divide-[#EEEEEA]">
              {outOfStockProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[#F6F6F1]"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#465047]">
                      {item.product.name}
                    </p>
                    <p className="mt-1 text-[10px] text-[#858D84]">
                      SKU: {item.product.sku} · {item.branch.name}
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center rounded-md border border-[#E8D5D2] bg-[#F5EAE8] px-2.5 py-1 text-[10px] font-medium text-[#A65D56]">
                    Out of stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
