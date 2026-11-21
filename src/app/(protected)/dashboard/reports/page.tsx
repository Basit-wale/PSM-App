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
}: {
  label: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-zinc-500">{description}</p>
      )}
    </div>
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

  if (!hasPermission(role, "reports:read")) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-3 text-sm text-red-600">
          You do not have permission to view reports.
        </p>
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

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Reports</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Business performance and activity for {membership.organization.name}
            .
          </p>
        </div>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold text-zinc-900">Report filters</h2>

          <form
            method="GET"
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label
                htmlFor="startDate"
                className="mb-1 block text-sm font-medium"
              >
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-1 block text-sm font-medium"
              >
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDate}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="branchId"
                className="mb-1 block text-sm font-medium"
              >
                Branch
              </label>
              <select
                id="branchId"
                name="branchId"
                defaultValue={selectedBranch}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
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
                className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Apply filters
              </button>
            </div>
          </form>

          <p className="mt-3 text-xs text-zinc-500">
            Showing {startDate} to {endDate}
            {selectedBranch
              ? ` · ${branches.find((item) => item.id === selectedBranch)?.name}`
              : " · All accessible branches"}
          </p>

          {!validRange && (
            <p className="mt-3 text-sm text-red-600">
              The end date must not be earlier than the start date.
            </p>
          )}
        </section>

        {canViewSales && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Sales performance
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Paid revenue"
                value={formatAmount(revenue, currency)}
                description="Successful payments received during this period"
              />
              <StatCard
                label="Completed payments"
                value={paymentCount}
                description="Number of successful payment transactions"
              />
            </div>
          </section>
        )}

        {canViewExpenses && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Expense performance
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Paid expenses"
                value={formatAmount(expensesPaid, currency)}
                description="Expenses paid during this period"
              />
              <StatCard
                label="Paid expense records"
                value={expenseCount}
                description="Number of paid expense records"
              />
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="font-semibold text-zinc-900">
                Expenses by category
              </h3>
              {expenseCategories.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  No paid expenses found for this period.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-zinc-100">
                  {expenseCategories.map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between gap-4 py-3 text-sm"
                    >
                      <span className="text-zinc-600">{item.name}</span>
                      <span className="font-medium text-zinc-900">
                        {formatAmount(item.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {canViewSales && canViewExpenses && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Operating overview
            </h2>
            <StatCard
              label="Estimated net operating income"
              value={formatAmount(revenue - expensesPaid, currency)}
              description="Paid revenue minus paid expenses. This is not a full accounting profit calculation."
            />
          </section>
        )}

        {canViewAppointments && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Appointment performance
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total appointments"
                value={appointmentCounts.total}
              />
              <StatCard label="Pending" value={appointmentCounts.pending} />
              <StatCard label="Confirmed" value={appointmentCounts.confirmed} />
              <StatCard
                label="In progress"
                value={appointmentCounts.inProgress}
              />
              <StatCard label="Completed" value={appointmentCounts.completed} />
              <StatCard label="Cancelled" value={appointmentCounts.cancelled} />
              <StatCard label="No shows" value={appointmentCounts.noShow} />
            </div>
          </section>
        )}

        {canViewSales && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold text-zinc-900">
              Best-selling products
            </h2>

            {bestSellingProducts.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No product sales found for this period.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Product</th>
                      <th className="py-3 pr-4 text-right font-medium">
                        Quantity sold
                      </th>
                      <th className="py-3 text-right font-medium">
                        Sales total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellingProducts.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-900">
                          {item.name}
                        </td>
                        <td className="py-3 pr-4 text-right text-zinc-600">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-right font-medium text-zinc-900">
                          {formatAmount(item.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {canViewSales && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold text-zinc-900">
              Best-selling services
            </h2>

            {bestSellingServices.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                No service sales found for this period.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Service</th>
                      <th className="py-3 pr-4 text-right font-medium">
                        Quantity sold
                      </th>
                      <th className="py-3 text-right font-medium">
                        Sales total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellingServices.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-zinc-100 last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-900">
                          {item.name}
                        </td>
                        <td className="py-3 pr-4 text-right text-zinc-600">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-right font-medium text-zinc-900">
                          {formatAmount(item.revenue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
