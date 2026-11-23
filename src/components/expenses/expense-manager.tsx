"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createExpense,
  createExpenseCategory,
  reviewExpense,
  markExpensePaid,
} from "@/app/actions/expense";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";

type Branch = {
  id: string;
  name: string;
  code: string;
};

type Category = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  branchId: string;
  branchName: string;
  categoryName: string;
  description: string;
  amount: string;
  vendor: string | null;
  reference: string | null;
  status: string;
  expenseDate: string;
  createdAt: string;
  paidAt: string | null;
  submittedByMemberId: string;
};

type Props = {
  branches: Branch[];
  categories: Category[];
  expenses: Expense[];
  canCreate: boolean;
  canApprove: boolean;
  canPay: boolean;
  canManageCategories: boolean;
  currentMemberId: string;
};

function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatAmount(value: string) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getExpenseReportDate(expense: Expense) {
  if (expense.status === "PAID" && expense.paidAt) {
    return dateKey(new Date(expense.paidAt));
  }

  return expense.expenseDate.slice(0, 10);
}

function getReportRange(
  period: string,
  customStart: string,
  customEnd: string,
) {
  const today = new Date();

  if (period === "CUSTOM") {
    return { start: customStart, end: customEnd };
  }

  if (period === "WEEKLY") {
    const start = new Date(today);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start: dateKey(start), end: dateKey(end) };
  }

  if (period === "YEARLY") {
    return {
      start: `${today.getFullYear()}-01-01`,
      end: `${today.getFullYear()}-12-31`,
    };
  }

  return {
    start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

function statusVariant(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "APPROVED":
      return "info" as const;
    case "PENDING":
      return "warning" as const;
    case "REJECTED":
    case "VOIDED":
      return "destructive" as const;
    default:
      return "muted" as const;
  }
}

const inputClass =
  "h-10 w-full rounded-lg border border-[#DDE2DA] bg-[#FBFAF7] px-3 text-sm text-[#39443B] shadow-none outline-none transition-colors placeholder:text-[#A0A79F] focus:border-[#829783] focus:ring-2 focus:ring-[#829783]/15";

const panelClass =
  "overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(35,45,35,0.03)]";

function SectionHeading({
  title,
  description,
  trailing,
}: {
  title: string;
  description?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E9E2] px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-[#3D493F]">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-[#858E84]">{description}</p>
        )}
      </div>
      {trailing}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] px-4 py-4 shadow-[0_1px_2px_rgba(35,45,35,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#7C857B]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-[#354137]">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#8B938A]">{description}</p>
    </div>
  );
}

export function ExpenseManager({
  branches,
  categories,
  expenses,
  currentMemberId,
  canCreate,
  canApprove,
  canPay,
  canManageCategories,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [reference, setReference] = useState("");
  const [expenseDate, setExpenseDate] = useState(localDate());

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [reportBranch, setReportBranch] = useState("");
  const [reportPeriod, setReportPeriod] = useState("MONTHLY");
  const [customStart, setCustomStart] = useState(localDate());
  const [customEnd, setCustomEnd] = useState(localDate());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (filterBranch && expense.branchId !== filterBranch) return false;
      if (filterStatus && expense.status !== filterStatus) return false;
      return true;
    });
  }, [expenses, filterBranch, filterStatus]);

  const reportRange = useMemo(
    () => getReportRange(reportPeriod, customStart, customEnd),
    [reportPeriod, customStart, customEnd],
  );

  const reportExpenses = useMemo(() => {
    if (
      reportPeriod === "CUSTOM" &&
      (!customStart || !customEnd || customStart > customEnd)
    ) {
      return [];
    }

    return expenses.filter((expense) => {
      if (reportBranch && expense.branchId !== reportBranch) return false;

      const expenseDate = getExpenseReportDate(expense);

      return expenseDate >= reportRange.start && expenseDate <= reportRange.end;
    });
  }, [
    expenses,
    reportBranch,
    reportPeriod,
    customStart,
    customEnd,
    reportRange,
  ]);

  const reportTotals = useMemo(() => {
    const total = (status: string) =>
      reportExpenses
        .filter((expense) => expense.status === status)
        .reduce((sum, expense) => sum + Number(expense.amount), 0);

    return {
      paid: total("PAID"),
      pending: total("PENDING"),
      approved: total("APPROVED"),
      rejected: total("REJECTED"),
    };
  }, [reportExpenses]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    for (const expense of reportExpenses) {
      totals.set(
        expense.categoryName,
        (totals.get(expense.categoryName) ?? 0) + Number(expense.amount),
      );
    }

    return Array.from(totals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [reportExpenses]);

  const categoryMaximum = Math.max(
    ...categoryTotals.map((item) => item.amount),
    0,
  );

  function showResult(
    result:
      { success: true; message: string } | { success: false; error: string },
  ) {
    if (!result.success) {
      setError(result.error);
      setSuccess("");
      return;
    }

    setSuccess(result.message);
    setError("");
    router.refresh();
  }

  function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await createExpense({
        branchId,
        categoryId,
        description,
        amount,
        vendor,
        reference,
        expenseDate,
      });

      if (result.success) {
        setDescription("");
        setAmount("");
        setVendor("");
        setReference("");
        setCategoryId("");
        setExpenseDate(localDate());
      }

      showResult(result);
    });
  }

  function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await createExpenseCategory(
        categoryName,
        categoryDescription,
      );

      if (result.success) {
        setCategoryName("");
        setCategoryDescription("");
      }

      showResult(result);
    });
  }

  function handleReview(expenseId: string, decision: "APPROVED" | "REJECTED") {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await reviewExpense(expenseId, decision);
      showResult(result);
    });
  }

  function handleMarkPaid(expenseId: string) {
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await markExpensePaid(expenseId);
      showResult(result);
    });
  }

  return (
    <main className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#354137]">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-[#7C857B]">
            Record, review and track your business spending.
          </p>
        </div>

        {canCreate && (
          <Button
            type="button"
            onClick={() =>
              document.getElementById("expense-entry")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
            className="h-9 rounded-lg bg-[#617968] px-4 text-xs font-medium text-white shadow-sm hover:bg-[#526957]"
          >
            Record expense
          </Button>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg border border-[#E8C9C5] bg-[#FBF0EE] px-4 py-3 text-xs text-[#A34F49]">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-[#D5E2D3] bg-[#EDF4EB] px-4 py-3 text-xs text-[#526F55]">
          {success}
        </div>
      )}

      {/* Expense reporting */}
      <section className={panelClass}>
        <SectionHeading
          title="Expense overview"
          description="Review spending and expense status across your branches."
          trailing={
            <Badge variant="muted">{reportExpenses.length} records</Badge>
          }
        />

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="Branch"
              htmlFor="report-branch"
              labelClassName="text-xs font-medium text-[#59645A]"
            >
              <Select
                id="report-branch"
                value={reportBranch}
                onChange={(event) => setReportBranch(event.target.value)}
                className={inputClass}
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Reporting period"
              htmlFor="report-period"
              labelClassName="text-xs font-medium text-[#59645A]"
            >
              <Select
                id="report-period"
                value={reportPeriod}
                onChange={(event) => setReportPeriod(event.target.value)}
                className={inputClass}
              >
                <option value="WEEKLY">This week</option>
                <option value="MONTHLY">This month</option>
                <option value="YEARLY">This year</option>
                <option value="CUSTOM">Custom date range</option>
              </Select>
            </FormField>

            {reportPeriod === "CUSTOM" && (
              <>
                <FormField
                  label="Start date"
                  htmlFor="report-start"
                  labelClassName="text-xs font-medium text-[#59645A]"
                >
                  <Input
                    id="report-start"
                    type="date"
                    value={customStart}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className={inputClass}
                  />
                </FormField>

                <FormField
                  label="End date"
                  htmlFor="report-end"
                  labelClassName="text-xs font-medium text-[#59645A]"
                >
                  <Input
                    id="report-end"
                    type="date"
                    min={customStart}
                    value={customEnd}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className={inputClass}
                  />
                </FormField>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F1F2EC] px-3 py-2.5">
            <span className="text-[11px] font-medium text-[#707B70]">
              REPORTING PERIOD
            </span>
            <span className="text-xs font-medium text-[#465448]">
              {reportRange.start} — {reportRange.end}
            </span>
          </div>

          {reportPeriod === "CUSTOM" &&
            customStart &&
            customEnd &&
            customStart > customEnd && (
              <p className="text-xs text-[#A34F49]">
                End date must not be earlier than start date.
              </p>
            )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total paid"
              value={formatAmount(String(reportTotals.paid))}
              description="Expenses already paid"
            />
            <SummaryCard
              label="Pending"
              value={formatAmount(String(reportTotals.pending))}
              description="Awaiting review"
            />
            <SummaryCard
              label="Approved"
              value={formatAmount(String(reportTotals.approved))}
              description="Awaiting payment"
            />
            <SummaryCard
              label="Rejected"
              value={formatAmount(String(reportTotals.rejected))}
              description="Expenses not approved"
            />
          </div>

          {/* Category breakdown */}
          <div className="rounded-xl border border-[#E8E9E2] bg-[#F9F9F5] p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#465247]">
                Spending by category
              </h3>
              <p className="mt-1 text-xs text-[#8B938A]">
                Category breakdown for the selected reporting period.
              </p>
            </div>

            {categoryTotals.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#929A91]">
                No expenses found for this period.
              </p>
            ) : (
              <div className="space-y-4">
                {categoryTotals.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-[#59645A]">
                        {item.name}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-[#465247]">
                        {formatAmount(String(item.amount))}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#E9ECE5]">
                      <div
                        className="h-full rounded-full bg-[#829783] transition-all"
                        style={{
                          width: `${
                            categoryMaximum > 0
                              ? (item.amount / categoryMaximum) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#929A91]">
            Based on {reportExpenses.length} expense records. Paid expenses use
            their payment date; other statuses use their expense date.
          </p>
        </div>
      </section>

      {/* Record expense */}
      {canCreate && (
        <section id="expense-entry" className={panelClass}>
          <SectionHeading
            title="Record an expense"
            description="Add a new business expense to your records."
          />

          <form onSubmit={handleCreateExpense} className="space-y-5 p-5">
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <FormField
                label="Branch"
                htmlFor="expense-branch"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Select
                  id="expense-branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Category"
                htmlFor="expense-category"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Select
                  id="expense-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Description"
                htmlFor="expense-description"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="expense-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What was the expense for?"
                  required
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Amount"
                htmlFor="expense-amount"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Vendor"
                htmlFor="expense-vendor"
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="expense-vendor"
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                  placeholder="Vendor or supplier"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Reference"
                htmlFor="expense-reference"
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="expense-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Invoice or transaction reference"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Expense date"
                htmlFor="expense-date"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  required
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="flex justify-end border-t border-[#E8E9E2] pt-4">
              <Button
                type="submit"
                disabled={isPending || !branches.length || !categories.length}
                className="h-9 rounded-lg bg-[#617968] px-5 text-xs font-medium text-white hover:bg-[#526957]"
              >
                {isPending ? "Saving..." : "Save expense"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Category management */}
      {canManageCategories && (
        <section className={panelClass}>
          <SectionHeading
            title="Expense categories"
            description="Organize expenses using categories for easier reporting."
            trailing={
              <Badge variant="muted">{categories.length} categories</Badge>
            }
          />

          <div className="space-y-4 p-5">
            <form
              onSubmit={handleCreateCategory}
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="New category name"
                aria-label="New category name"
                required
                className={inputClass}
              />

              <Input
                value={categoryDescription}
                onChange={(event) => setCategoryDescription(event.target.value)}
                placeholder="Description (optional)"
                aria-label="Category description"
                className={inputClass}
              />

              <Button
                type="submit"
                disabled={isPending}
                className="h-10 rounded-lg bg-[#617968] px-4 text-xs text-white hover:bg-[#526957]"
              >
                Add category
              </Button>
            </form>

            {categories.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-[#E8E9E2] pt-4">
                {categories.map((category) => (
                  <Badge key={category.id} variant="muted">
                    {category.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#929A91]">
                No expense categories have been created yet.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Expense history */}
      <section className={panelClass}>
        <SectionHeading
          title="Expense history"
          description="Review expenses and manage their approval and payment status."
          trailing={
            <Badge variant="muted">
              {filteredExpenses.length}{" "}
              {filteredExpenses.length === 1 ? "expense" : "expenses"}
            </Badge>
          }
        />

        <div className="flex flex-wrap items-center gap-3 border-b border-[#E8E9E2] bg-[#F9F9F5] px-5 py-3">
          <div className="min-w-[170px] flex-1 sm:max-w-[220px]">
            <Select
              value={filterBranch}
              onChange={(event) => setFilterBranch(event.target.value)}
              aria-label="Filter by branch"
              className={inputClass}
            >
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="min-w-[170px] flex-1 sm:max-w-[200px]">
            <Select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              aria-label="Filter by status"
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
              <option value="VOIDED">Voided</option>
            </Select>
          </div>

          {(filterBranch || filterStatus) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterBranch("");
                setFilterStatus("");
              }}
              className="h-9 rounded-lg px-3 text-xs text-[#617968] hover:bg-[#EDF1EB]"
            >
              Clear filters
            </Button>
          )}
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-[#465247]">
              No expenses found
            </p>
            <p className="mt-1 text-xs text-[#929A91]">
              Try changing your filters or record a new expense.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="border-b border-[#E8E9E2] bg-[#F4F4EE]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Description
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#ECEDE7]">
                {filteredExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="transition-colors hover:bg-[#F5F6F1]"
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#687268]">
                      {formatDate(expense.expenseDate)}
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-[#465247]">
                        {expense.branchName}
                      </p>
                    </td>

                    <td className="max-w-[230px] px-4 py-3.5">
                      <p className="text-xs font-medium text-[#39443B]">
                        {expense.description}
                      </p>
                      {expense.vendor && (
                        <p className="mt-1 text-[11px] text-[#858E84]">
                          {expense.vendor}
                        </p>
                      )}
                      {expense.reference && (
                        <p className="mt-1 text-[10px] text-[#929A91]">
                          Ref: {expense.reference}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs text-[#687268]">
                      {expense.categoryName}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-semibold tabular-nums text-[#39443B]">
                      {formatAmount(expense.amount)}
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge>{expense.status}</Badge>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        {canApprove &&
                          expense.submittedByMemberId !== currentMemberId &&
                          expense.status === "PENDING" && (
                            <>
                              <Button
                                size="xs"
                                disabled={isPending}
                                onClick={() =>
                                  handleReview(expense.id, "APPROVED")
                                }
                                className="h-7 rounded-md bg-[#617968] px-2.5 text-[10px] text-white hover:bg-[#526957]"
                              >
                                Approve
                              </Button>

                              <Button
                                size="xs"
                                variant="outline"
                                disabled={isPending}
                                onClick={() =>
                                  handleReview(expense.id, "REJECTED")
                                }
                                className="h-7 rounded-md border-[#E3D1CE] px-2.5 text-[10px] text-[#A35B54] hover:bg-[#FBF0EE]"
                              >
                                Reject
                              </Button>
                            </>
                          )}

                        {canPay && expense.status === "APPROVED" && (
                          <Button
                            size="xs"
                            disabled={isPending}
                            onClick={() => handleMarkPaid(expense.id)}
                            className="h-7 rounded-md bg-[#617968] px-2.5 text-[10px] text-white hover:bg-[#526957]"
                          >
                            Mark paid
                          </Button>
                        )}

                        {expense.status !== "PENDING" &&
                          expense.status !== "APPROVED" && (
                            <span className="text-[10px] text-[#A0A79F]">
                              No actions
                            </span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
