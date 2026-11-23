import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth-guard";

export const instant = false;

type Period = "quarter" | "half-year" | "year" | "custom";

type SearchParams = {
  period?: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
};

function getPeriodDates(period: Period, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (period === "custom") {
    if (!startDate || !endDate) {
      throw new Error("Choose both custom dates.");
    }

    start = new Date(`${startDate}T00:00:00.000Z`);
    end = new Date(`${endDate}T00:00:00.000Z`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      startDate > endDate
    ) {
      throw new Error("Invalid date range.");
    }

    const minimumEnd = new Date(start);
    minimumEnd.setUTCMonth(minimumEnd.getUTCMonth() + 1);

    if (end < minimumEnd) {
      throw new Error("Custom date range must be at least one month.");
    }
  } else if (period === "quarter") {
    const quarter = Math.floor(now.getUTCMonth() / 3);
    start = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 1));
  } else if (period === "half-year") {
    const half = now.getUTCMonth() < 6 ? 0 : 1;
    start = new Date(Date.UTC(now.getUTCFullYear(), half * 6, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), half * 6 + 6, 1));
  } else {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  }

  return { start, end };
}

const money = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);

export default async function CustomerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
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
      branches: {
        where: {
          branch: { status: "ACTIVE" },
        },
        select: { branchId: true },
      },
    },
  });

  if (!membership) redirect("/setup");

  await requirePermission(membership.organizationId, "customers:read");

  const params = await searchParams;
  const isOrganizationWide =
    membership.role === "OWNER" || membership.role === "ADMIN";

  const assignedBranchIds = membership.branches.map((item) => item.branchId);

  const branches = await db.branch.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "ACTIVE",
      ...(isOrganizationWide ? {} : { id: { in: assignedBranchIds } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const requestedPeriod = params.period;
  const period: Period =
    requestedPeriod === "half-year" ||
    requestedPeriod === "year" ||
    requestedPeriod === "custom"
      ? requestedPeriod
      : "quarter";

  let dates: { start: Date; end: Date };
  let dateError = "";

  try {
    dates = getPeriodDates(period, params.startDate, params.endDate);
  } catch (error) {
    dateError = error instanceof Error ? error.message : "Invalid date range.";
    dates = getPeriodDates("quarter");
  }

  const selectedBranch =
    params.branchId && branches.some((branch) => branch.id === params.branchId)
      ? params.branchId
      : null;

  const payments = await db.payment.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "COMPLETED",
      paidAt: {
        gte: dates.start,
        lt: dates.end,
      },
    },
    select: {
      amount: true,
      sale: {
        select: {
          id: true,
          branchId: true,
          customerId: true,
          status: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      },
    },
  });

  const customerMap = new Map<
    string,
    {
      id: string;
      name: string;
      phone: string;
      email: string;
      revenue: number;
      saleIds: Set<string>;
    }
  >();

  for (const payment of payments) {
    const sale = payment.sale;
    const customer = sale.customer;

    if (
      !customer ||
      !sale.customerId ||
      sale.status === "VOIDED" ||
      sale.status === "REFUNDED"
    ) {
      continue;
    }

    if (selectedBranch && sale.branchId !== selectedBranch) {
      continue;
    }

    if (!isOrganizationWide && !assignedBranchIds.includes(sale.branchId)) {
      continue;
    }

    const existing = customerMap.get(customer.id);

    if (existing) {
      existing.revenue += Number(payment.amount);
      existing.saleIds.add(sale.id);
    } else {
      customerMap.set(customer.id, {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName ?? ""}`.trim(),
        phone: customer.phone,
        email: customer.email ?? "",
        revenue: Number(payment.amount),
        saleIds: new Set([sale.id]),
      });
    }
  }

  const customerRows = Array.from(customerMap.values())
    .map((customer) => ({
      ...customer,
      purchases: customer.saleIds.size,
      averageSpend:
        customer.saleIds.size > 0
          ? customer.revenue / customer.saleIds.size
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = customerRows.reduce(
    (sum, customer) => sum + customer.revenue,
    0,
  );

  const totalPurchases = customerRows.reduce(
    (sum, customer) => sum + customer.purchases,
    0,
  );

  const averageSpend = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

  const periodLabels: Record<Period, string> = {
    quarter: "Current quarter",
    "half-year": "Current half-year",
    year: "Current year",
    custom: "Custom period",
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#354139]">
            Customer Analytics
          </h1>
          <p className="mt-1 text-sm text-[#858D84]">
            Understand customer spending and identify your most valuable
            customers.
          </p>
        </div>

        <Link
          href="/dashboard/customers"
          className="rounded-lg border border-[#DDE1D8] px-4 py-2 text-sm font-medium text-[#596359] hover:bg-[#F5F6F1]"
        >
          Back to Customers
        </Link>
      </div>

      <form
        method="GET"
        className="rounded-xl border border-[#E3E5DD] bg-white p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-[#596359]">
            Reporting period
            <select
              name="period"
              defaultValue={period}
              className="mt-2 w-full rounded-lg border border-[#DDE1D8] bg-white px-3 py-2.5 text-sm"
            >
              <option value="quarter">Quarterly</option>
              <option value="half-year">Half-yearly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>

          <label className="text-xs font-medium text-[#596359]">
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={params.startDate ?? ""}
              className="mt-2 w-full rounded-lg border border-[#DDE1D8] bg-white px-3 py-2.5 text-sm disabled:bg-[#F3F4F0]"
            />
          </label>

          <label className="text-xs font-medium text-[#596359]">
            End date
            <input
              type="date"
              name="endDate"
              defaultValue={params.endDate ?? ""}
              className="mt-2 w-full rounded-lg border border-[#DDE1D8] bg-white px-3 py-2.5 text-sm disabled:bg-[#F3F4F0]"
            />
          </label>

          <label className="text-xs font-medium text-[#596359]">
            Branch
            <select
              name="branchId"
              defaultValue={selectedBranch ?? ""}
              className="mt-2 w-full rounded-lg border border-[#DDE1D8] bg-white px-3 py-2.5 text-sm"
            >
              {isOrganizationWide && <option value="">All branches</option>}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {dateError && <p className="mt-3 text-xs text-red-600">{dateError}</p>}

        {period === "custom" && (
          <p className="mt-3 text-xs text-[#92978F]">
            Custom periods must cover at least one month.
          </p>
        )}

        <button
          type="submit"
          className="mt-4 rounded-lg bg-[#526B57] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#435947]"
        >
          Apply filters
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Customer revenue",
            value: money(totalRevenue),
          },
          {
            label: "Purchases",
            value: totalPurchases.toLocaleString(),
          },
          {
            label: "Customers",
            value: customerRows.length.toLocaleString(),
          },
          {
            label: "Average purchase",
            value: money(averageSpend),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#E3E5DD] bg-white p-5"
          >
            <p className="text-xs font-medium text-[#858D84]">{stat.label}</p>
            <p className="mt-3 text-xl font-semibold text-[#354139]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E3E5DD] bg-white">
        <div className="border-b border-[#E8E9E2] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#414B42]">
            Customer spending
          </h2>
          <p className="mt-1 text-xs text-[#92978F]">
            {periodLabels[period]} · Completed payments only · Highest revenue
            first
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#F7F8F5]">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#858D84]">
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3 text-right">Purchases</th>
                <th className="px-5 py-3 text-right">Average spend</th>
                <th className="px-5 py-3 text-right">Total revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0EB]">
              {customerRows.map((customer, index) => (
                <tr key={customer.id} className="text-sm">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E9EEE8] text-[11px] font-semibold text-[#526B57]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-[#414B42]">
                          {customer.name}
                        </p>
                        {customer.email && (
                          <p className="mt-0.5 text-xs text-[#92978F]">
                            {customer.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#687269]">
                    {customer.phone}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-[#596359]">
                    {customer.purchases}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-[#596359]">
                    {money(customer.averageSpend)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold tabular-nums text-[#435947]">
                    {money(customer.revenue)}
                  </td>
                </tr>
              ))}

              {customerRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-[#92978F]"
                  >
                    No customer purchases found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
