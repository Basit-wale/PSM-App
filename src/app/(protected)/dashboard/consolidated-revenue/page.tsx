import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const instant = false;

type SearchParams = Promise<{
  startDate?: string;
  endDate?: string;
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

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  accent: "green" | "amber" | "dark";
}) {
  const styles = {
    green: "bg-[#e8eee6] text-[#48634d]",
    amber: "bg-[#f5eddd] text-[#94713a]",
    dark: "bg-[#e1e9df] text-[#294b35]",
  };

  return (
    <div className="rounded-2xl border border-[#e5e7dc] bg-white p-5 shadow-[0_2px_10px_rgba(43,61,43,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#858b7e]">
        {label}
      </p>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-[#263d2d]">
        {value}
      </p>
      <span
        className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${styles[accent]}`}
      >
        {description}
      </span>
    </div>
  );
}

export default async function ConsolidatedRevenuePage({
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
    },
  });

  if (!membership) redirect("/setup");

  if (membership.role !== "OWNER") {
    redirect("/dashboard");
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

  const validRange = startDate <= endDate;

  const organizationId = membership.organizationId;
  const currency = membership.organization.currency || "NGN";

  const [payments, manualEntries] = validRange
    ? await Promise.all([
        db.payment.findMany({
          where: {
            organizationId,
            status: "COMPLETED",
            paidAt: {
              gte: start,
              lt: end,
            },
            sale: {
              organizationId,
            },
          },
          select: {
            amount: true,
            sale: {
              select: {
                branchId: true,
              },
            },
          },
        }),
        db.manualPerformanceEntry.findMany({
          where: {
            organizationId,
            workDate: {
              gte: start,
              lt: end,
            },
          },
          select: {
            id: true,
            revenue: true,
            workDate: true,
            branch: {
              select: {
                name: true,
              },
            },
            staff: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            workDate: "desc",
          },
        }),
      ])
    : [[], []];

  const coreBranchIds = [
    ...new Set(payments.map((payment) => payment.sale.branchId)),
  ];

  const coreBranches = coreBranchIds.length
    ? await db.branch.findMany({
        where: {
          organizationId,
          id: { in: coreBranchIds },
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  const coreBranchNames = new Map(
    coreBranches.map((branch) => [branch.id, branch.name]),
  );

  const posRevenue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  const manualRevenue = manualEntries.reduce(
    (sum, entry) => sum + Number(entry.revenue),
    0,
  );

  const combinedRevenue = posRevenue + manualRevenue;

  const posByBranch = new Map<string, number>();

  for (const payment of payments) {
    const branchId = payment.sale.branchId;
    posByBranch.set(
      branchId,
      (posByBranch.get(branchId) ?? 0) + Number(payment.amount),
    );
  }

  const manualByBranch = new Map<string, number>();

  for (const entry of manualEntries) {
    const branchName = entry.branch.name;
    manualByBranch.set(
      branchName,
      (manualByBranch.get(branchName) ?? 0) + Number(entry.revenue),
    );
  }

  const totalRecords = payments.length + manualEntries.length;

  return (
    <main className="min-h-screen bg-[#f5f6f0] p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-[#718575] hover:text-[#294333]"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-[#294333]">
              Consolidated Revenue
            </h1>
            <p className="mt-1 text-sm text-[#858b7e]">
              {membership.organization.name} · Revenue across connected and
              manually reporting branches
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#e8eee6] px-3 py-1.5 text-xs font-medium text-[#48634d]">
            Owner report
          </span>
        </div>

        <section className="rounded-2xl border border-[#e5e7dc] bg-white p-5">
          <form className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="mb-1.5 block text-xs font-medium text-[#626b63]"
              >
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
                className="rounded-lg border border-[#e5e7dc] px-3 py-2 text-sm text-[#294333]"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="mb-1.5 block text-xs font-medium text-[#626b63]"
              >
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDate}
                className="rounded-lg border border-[#e5e7dc] px-3 py-2 text-sm text-[#294333]"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#48634d] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#294b35]"
            >
              Apply filters
            </button>
            <Link
              href="/dashboard/consolidated-revenue"
              className="px-2 py-2.5 text-sm font-medium text-[#718575] hover:text-[#294333]"
            >
              Reset
            </Link>
          </form>
          {!validRange && (
            <p className="mt-3 text-xs text-red-600">
              The start date must not be after the end date.
            </p>
          )}
          <p className="mt-3 text-xs text-[#858b7e]">
            Showing {startDate} to {endDate}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="POS Revenue"
            value={formatAmount(posRevenue, currency)}
            description={`${payments.length} completed payments`}
            accent="green"
          />
          <StatCard
            label="Manual Revenue"
            value={formatAmount(manualRevenue, currency)}
            description={`${manualEntries.length} self-reported entries`}
            accent="amber"
          />
          <StatCard
            label="Combined Revenue"
            value={formatAmount(combinedRevenue, currency)}
            description={`${totalRecords} recorded entries`}
            accent="dark"
          />
        </section>

        <section className="rounded-xl border border-[#eadfc9] bg-[#fbf7ed] p-4">
          <p className="text-sm font-semibold text-[#765d31]">
            Important reporting distinction
          </p>
          <p className="mt-1 text-xs leading-5 text-[#8b7955]">
            POS revenue comes from completed software payments. Manual revenue
            is self-reported by staff or management and has not been verified
            against POS transactions. These figures are combined for reporting
            only; manual entries do not become POS sales or accounting
            transactions.
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e7dc] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#294333]">
              Connected branches — POS revenue
            </h2>
            <p className="mt-1 text-xs text-[#858b7e]">
              Based on completed payments recorded in the software
            </p>
          </div>
          {posByBranch.size === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#858b7e]">
              No POS payments found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f8f3] text-left text-[10px] uppercase tracking-wider text-[#858b7e]">
                  <tr>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3 text-right">POS revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0e8]">
                  {[...posByBranch.entries()].map(([branchId, amount]) => (
                    <tr key={branchId}>
                      <td className="px-5 py-3 font-medium text-[#46594b]">
                        {coreBranchNames.get(branchId) ?? "Unknown branch"}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-[#294333]">
                        {formatAmount(amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e7dc] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#294333]">
              Unconnected branches — Manual revenue
            </h2>
            <p className="mt-1 text-xs text-[#858b7e]">
              Self-reported figures from the Manual Performance module
            </p>
          </div>
          {manualByBranch.size === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#858b7e]">
              No manual revenue entries found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f8f3] text-left text-[10px] uppercase tracking-wider text-[#858b7e]">
                  <tr>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3 text-right">Manual revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0e8]">
                  {[...manualByBranch.entries()].map(([branchName, amount]) => (
                    <tr key={branchName}>
                      <td className="px-5 py-3 font-medium text-[#46594b]">
                        {branchName}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-[#94713a]">
                        {formatAmount(amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e7dc] bg-white">
          <div className="border-b border-[#edf0e8] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#294333]">
              Manual revenue entries
            </h2>
            <p className="mt-1 text-xs text-[#858b7e]">
              Individual self-reported entries included in the totals
            </p>
          </div>
          {manualEntries.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#858b7e]">
              No manual entries found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f7f8f3] text-left text-[10px] uppercase tracking-wider text-[#858b7e]">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3">Staff</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0e8]">
                  {manualEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-[#626b63]">
                        {dateString(new Date(entry.workDate))}
                      </td>
                      <td className="px-5 py-3 text-[#46594b]">
                        {entry.branch.name}
                      </td>
                      <td className="px-5 py-3 text-[#626b63]">
                        {entry.staff.name}
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-[#94713a]">
                        {formatAmount(Number(entry.revenue), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
