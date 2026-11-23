import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

export const instant = false;

type SearchParams = Promise<{
  startDate?: string;
  endDate?: string;
  branchId?: string;
}>;

function dateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && dateString(date) === value;
}

function formatAmount(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function StatCard({
  label,
  value,
  description,
  accent = "sage",
}: {
  label: string;
  value: string | number;
  description?: string;
  accent?: "sage" | "forest" | "amber" | "neutral";
}) {
  const accentStyles = {
    sage: "bg-[#e8eee6] text-[#48634d]",
    forest: "bg-[#e1e9df] text-[#294b35]",
    amber: "bg-[#f5eddd] text-[#94713a]",
    neutral: "bg-[#efeee8] text-[#62685e]",
  };

  return (
    <div className="rounded-2xl border border-[#e5e7dc] bg-white p-5 shadow-[0_2px_10px_rgba(43,61,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858b7e]">
          {label}
        </p>
        <span className={`h-2.5 w-2.5 rounded-full ${accentStyles[accent]}`} />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-[#263d2d]">
        {value}
      </p>
      {description && (
        <p className="mt-2 text-xs leading-5 text-[#858b7e]">{description}</p>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-[#294333]">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs text-[#858b7e]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ReportTable({
  title,
  description,
  emptyMessage,
  headers,
  children,
  isEmpty,
}: {
  title: string;
  description?: string;
  emptyMessage: string;
  headers: string[];
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e7dc] bg-white shadow-[0_2px_10px_rgba(43,61,43,0.03)]">
      <div className="border-b border-[#edf0e8] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#294333]">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-[#858b7e]">{description}</p>
        )}
      </div>

      {isEmpty ? (
        <div className="px-5 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#edf1e9] text-[#627b64]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-5 w-5"
            >
              <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-[#536052]">
            Nothing to show yet
          </p>
          <p className="mt-1 text-xs text-[#92978c]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f7f8f3] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#858b7e]">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={header}
                    className={`whitespace-nowrap px-5 py-3 ${
                      index > 0 ? "text-right" : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0e8]">{children}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
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
        select: {
          name: true,
          currency: true,
        },
      },
      branches: {
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!membership) redirect("/setup");

  const role = membership.role;
  const organizationId = membership.organizationId;
  const branchIds = membership.branches.map((item) => item.branchId);
  const isOrganizationWide = role === "OWNER" || role === "ADMIN";

  if (role !== "OWNER" && role !== "ACCOUNTANT") {
    return (
      <main className="min-h-screen bg-[#f5f6f0] p-6 md:p-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-[#e5e7dc] bg-white p-8">
          <h1 className="text-xl font-semibold text-[#294333]">
            Access denied
          </h1>
          <p className="mt-3 text-sm text-red-600">
            Only organization owners and accountants can access reports.
          </p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const now = new Date();

  const defaultStart = dateString(
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const defaultEnd = dateString(now);

  const startDate = validDate(params.startDate)
    ? params.startDate!
    : defaultStart;
  const endDate = validDate(params.endDate) ? params.endDate! : defaultEnd;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  end.setDate(end.getDate() + 1);

  const validRange = start <= end && startDate <= endDate;

  const branches = await db.branch.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      ...(isOrganizationWide ? {} : { id: { in: branchIds } }),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const selectedBranch =
    params.branchId && branches.some((item) => item.id === params.branchId)
      ? params.branchId
      : "";

  const branchFilter = selectedBranch
    ? { branchId: selectedBranch }
    : isOrganizationWide
      ? {}
      : { branchId: { in: branchIds } };

  const canViewSales =
    hasPermission(role, "sales:read") && hasPermission(role, "payments:read");

  const canViewExpenses = hasPermission(role, "expenses:read");
  const canViewAppointments = hasPermission(role, "appointments:read");

  let revenue = 0;
  let paymentCount = 0;
  let expensesPaid = 0;
  let expenseCount = 0;

  let appointments: { status: string }[] = [];

  let expenseRecords: {
    amount: unknown;
    category: { name: string };
  }[] = [];

  let productRecords: {
    description: string;
    quantity: unknown;
    total: unknown;
    product: { name: string } | null;
    service: { name: string } | null;
  }[] = [];

  if (validRange) {
    const [
      paymentTotals,
      paidExpenseTotals,
      appointmentRecords,
      expenseRows,
      soldProducts,
    ] = await Promise.all([
      canViewSales
        ? db.payment.aggregate({
            where: {
              organizationId,
              status: "COMPLETED",
              paidAt: {
                gte: start,
                lt: end,
              },
              sale: {
                organizationId,
                ...branchFilter,
              },
            },
            _sum: {
              amount: true,
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve(null),

      canViewExpenses
        ? db.expense.aggregate({
            where: {
              organizationId,
              ...branchFilter,
              status: "PAID",
              paidAt: {
                gte: start,
                lt: end,
              },
            },
            _sum: {
              amount: true,
            },
            _count: {
              id: true,
            },
          })
        : Promise.resolve(null),

      canViewAppointments
        ? db.appointment.findMany({
            where: {
              organizationId,
              ...branchFilter,
              startsAt: {
                gte: start,
                lt: end,
              },
            },
            select: {
              status: true,
            },
          })
        : Promise.resolve([]),

      canViewExpenses
        ? db.expense.findMany({
            where: {
              organizationId,
              ...branchFilter,
              status: "PAID",
              paidAt: {
                gte: start,
                lt: end,
              },
            },
            select: {
              amount: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      canViewSales
        ? db.saleItem.findMany({
            where: {
              sale: {
                organizationId,
                ...branchFilter,
                createdAt: {
                  gte: start,
                  lt: end,
                },
                status: {
                  notIn: ["DRAFT", "VOIDED", "REFUNDED"],
                },
              },
            },
            select: {
              description: true,
              quantity: true,
              total: true,
              product: {
                select: {
                  name: true,
                },
              },
              service: {
                select: {
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    revenue = Number(paymentTotals?._sum.amount ?? 0);
    paymentCount = paymentTotals?._count.id ?? 0;
    expensesPaid = Number(paidExpenseTotals?._sum.amount ?? 0);
    expenseCount = paidExpenseTotals?._count.id ?? 0;
    appointments = appointmentRecords;
    expenseRecords = expenseRows;
    productRecords = soldProducts;
  }

  const appointmentCounts = {
    total: appointments.length,
    pending: appointments.filter((item) => item.status === "PENDING").length,
    confirmed: appointments.filter((item) => item.status === "CONFIRMED")
      .length,
    inProgress: appointments.filter((item) => item.status === "IN_PROGRESS")
      .length,
    completed: appointments.filter((item) => item.status === "COMPLETED")
      .length,
    cancelled: appointments.filter((item) => item.status === "CANCELLED")
      .length,
    noShow: appointments.filter((item) => item.status === "NO_SHOW").length,
  };

  const categoryTotals = new Map<string, number>();

  for (const expense of expenseRecords) {
    const name = expense.category.name;
    categoryTotals.set(
      name,
      (categoryTotals.get(name) ?? 0) + Number(expense.amount),
    );
  }

  const expenseCategories = Array.from(categoryTotals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const productTotals = new Map<
    string,
    { quantity: number; revenue: number }
  >();

  for (const item of productRecords) {
    if (!item.product) continue;

    const name = item.product.name;
    const current = productTotals.get(name) ?? {
      quantity: 0,
      revenue: 0,
    };

    current.quantity += Number(item.quantity);
    current.revenue += Number(item.total);
    productTotals.set(name, current);
  }

  const bestSellingProducts = Array.from(productTotals.entries())
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const serviceTotals = new Map<
    string,
    { quantity: number; revenue: number }
  >();

  for (const item of productRecords) {
    if (!item.service) continue;

    const name = item.service.name;
    const current = serviceTotals.get(name) ?? {
      quantity: 0,
      revenue: 0,
    };

    current.quantity += Number(item.quantity);
    current.revenue += Number(item.total);
    serviceTotals.set(name, current);
  }

  const bestSellingServices = Array.from(serviceTotals.entries())
    .map(([name, values]) => ({ name, ...values }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const currency = membership.organization.currency || "NGN";
  const selectedBranchName = branches.find(
    (item) => item.id === selectedBranch,
  )?.name;

  return (
    <main className="min-h-screen bg-[#f5f6f0] px-4 py-6 md:px-7 md:py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Page heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#82917e]">
              Business insights
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#263d2d] md:text-3xl">
              Reports
            </h1>
            <p className="mt-2 text-sm text-[#858b7e]">
              Business performance and activity for{" "}
              <span className="font-medium text-[#536052]">
                {membership.organization.name}
              </span>
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dfe6da] bg-[#eaf0e7] px-3 py-2 text-xs font-medium text-[#526c55]">
            <span className="h-2 w-2 rounded-full bg-[#789477]" />
            Reporting overview
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-2xl border border-[#e5e7dc] bg-white p-5 shadow-[0_2px_10px_rgba(43,61,43,0.03)] md:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-[#294333]">
                Report filters
              </h2>
              <p className="mt-1 text-xs text-[#858b7e]">
                Choose a reporting period and branch
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#f0f2eb] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#73816e]">
              Filter data
            </span>
          </div>

          <form
            method="GET"
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label
                htmlFor="startDate"
                className="mb-2 block text-xs font-semibold text-[#596657]"
              >
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
                className="h-11 w-full rounded-xl border border-[#dfe4d9] bg-[#fbfcf8] px-3 text-sm text-[#344737] outline-none transition focus:border-[#829b7e] focus:ring-2 focus:ring-[#829b7e]/15"
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-2 block text-xs font-semibold text-[#596657]"
              >
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDate}
                className="h-11 w-full rounded-xl border border-[#dfe4d9] bg-[#fbfcf8] px-3 text-sm text-[#344737] outline-none transition focus:border-[#829b7e] focus:ring-2 focus:ring-[#829b7e]/15"
              />
            </div>

            <div>
              <label
                htmlFor="branchId"
                className="mb-2 block text-xs font-semibold text-[#596657]"
              >
                Branch
              </label>
              <select
                id="branchId"
                name="branchId"
                defaultValue={selectedBranch}
                className="h-11 w-full rounded-xl border border-[#dfe4d9] bg-[#fbfcf8] px-3 text-sm text-[#344737] outline-none transition focus:border-[#829b7e] focus:ring-2 focus:ring-[#829b7e]/15"
              >
                <option value="">All accessible branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-[#365640] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#294632] focus:outline-none focus:ring-2 focus:ring-[#829b7e] focus:ring-offset-2"
              >
                Apply filters
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#edf0e8] pt-4 text-xs text-[#858b7e]">
            <span className="font-semibold text-[#596657]">Period:</span>
            <span className="rounded-lg bg-[#f3f5ef] px-2.5 py-1.5 font-medium text-[#536052]">
              {startDate} — {endDate}
            </span>
            <span className="text-[#c0c7ba]">·</span>
            <span>{selectedBranchName || "All accessible branches"}</span>
          </div>

          {!validRange && (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              The end date must not be earlier than the start date.
            </p>
          )}
        </section>

        {/* Sales */}
        {canViewSales && (
          <Section
            title="Sales performance"
            description="Payment activity recorded during the selected period"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Paid revenue"
                value={formatAmount(revenue, currency)}
                description="Successful payments received during this period"
                accent="forest"
              />
              <StatCard
                label="Completed payments"
                value={paymentCount}
                description="Number of successful payment transactions"
                accent="sage"
              />
            </div>
          </Section>
        )}

        {/* Expenses */}
        {canViewExpenses && (
          <Section
            title="Expense performance"
            description="Track paid expenses and understand where money is going"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Paid expenses"
                value={formatAmount(expensesPaid, currency)}
                description="Expenses paid during this period"
                accent="amber"
              />
              <StatCard
                label="Paid expense records"
                value={expenseCount}
                description="Number of paid expense records"
                accent="neutral"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e5e7dc] bg-white shadow-[0_2px_10px_rgba(43,61,43,0.03)]">
              <div className="border-b border-[#edf0e8] px-5 py-4">
                <h3 className="text-sm font-semibold text-[#294333]">
                  Expenses by category
                </h3>
                <p className="mt-1 text-xs text-[#858b7e]">
                  Breakdown of paid expenses by category
                </p>
              </div>

              {expenseCategories.length === 0 ? (
                <div className="px-5 py-9 text-center text-sm text-[#858b7e]">
                  No paid expenses found for this period.
                </div>
              ) : (
                <div className="divide-y divide-[#edf0e8]">
                  {expenseCategories.map((item) => {
                    const percentage =
                      expensesPaid > 0 ? (item.amount / expensesPaid) * 100 : 0;

                    return (
                      <div key={item.name} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm font-medium text-[#536052]">
                            {item.name}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-[#294333]">
                            {formatAmount(item.amount, currency)}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf0e8]">
                            <div
                              className="h-full rounded-full bg-[#829b7e]"
                              style={{
                                width: `${Math.min(percentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-[10px] font-medium tabular-nums text-[#858b7e]">
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Operating overview */}
        {canViewSales && canViewExpenses && (
          <Section
            title="Operating overview"
            description="A simple view of paid revenue less paid expenses"
          >
            <StatCard
              label="Estimated net operating income"
              value={formatAmount(revenue - expensesPaid, currency)}
              description="Paid revenue minus paid expenses. This is not a full accounting profit calculation."
              accent="forest"
            />
          </Section>
        )}

        {/* Appointments */}
        {canViewAppointments && (
          <Section
            title="Appointment performance"
            description="Appointment activity and status breakdown for this period"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                label="Total appointments"
                value={appointmentCounts.total}
                accent="forest"
              />
              <StatCard
                label="Pending"
                value={appointmentCounts.pending}
                accent="amber"
              />
              <StatCard
                label="Confirmed"
                value={appointmentCounts.confirmed}
                accent="sage"
              />
              <StatCard
                label="In progress"
                value={appointmentCounts.inProgress}
                accent="neutral"
              />
              <StatCard
                label="Completed"
                value={appointmentCounts.completed}
                accent="forest"
              />
              <StatCard
                label="Cancelled"
                value={appointmentCounts.cancelled}
                accent="neutral"
              />
              <StatCard
                label="No shows"
                value={appointmentCounts.noShow}
                accent="amber"
              />
            </div>
          </Section>
        )}

        {/* Best-selling products */}
        {canViewSales && (
          <ReportTable
            title="Best-selling products"
            description="Top products ranked by quantity sold"
            emptyMessage="No product sales found for this period."
            headers={["Product", "Quantity sold", "Sales total"]}
            isEmpty={bestSellingProducts.length === 0}
          >
            {bestSellingProducts.map((item) => (
              <tr key={item.name} className="transition hover:bg-[#fafbf7]">
                <td className="px-5 py-4 font-medium text-[#344737]">
                  {item.name}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-[#687466]">
                  {item.quantity}
                </td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#294333]">
                  {formatAmount(item.revenue, currency)}
                </td>
              </tr>
            ))}
          </ReportTable>
        )}

        {/* Best-selling services */}
        {canViewSales && (
          <ReportTable
            title="Best-selling services"
            description="Top services ranked by quantity sold"
            emptyMessage="No service sales found for this period."
            headers={["Service", "Quantity sold", "Sales total"]}
            isEmpty={bestSellingServices.length === 0}
          >
            {bestSellingServices.map((item) => (
              <tr key={item.name} className="transition hover:bg-[#fafbf7]">
                <td className="px-5 py-4 font-medium text-[#344737]">
                  {item.name}
                </td>
                <td className="px-5 py-4 text-right tabular-nums text-[#687466]">
                  {item.quantity}
                </td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#294333]">
                  {formatAmount(item.revenue, currency)}
                </td>
              </tr>
            ))}
          </ReportTable>
        )}

        <div className="border-t border-[#e3e7dc] pt-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#9aa092]">
            Reports · {membership.organization.name}
          </p>
        </div>
      </div>
    </main>
  );
}
