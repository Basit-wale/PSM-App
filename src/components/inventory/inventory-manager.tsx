"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { getDailyActivity, setBranchStock } from "@/app/actions/inventory";
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

type Product = {
  id: string;
  name: string;
  sku: string;
};

type Balance = {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  updatedAt: string;
};

type ActivityRow = {
  id: string;
  saleId: string;
  receiptNumber: string;
  branchName: string;
  timestamp: string;
  processedBy: string;
  staffId: string | null;
  staffName: string;
  itemName: string;
  type: "PRODUCT" | "SERVICE";
  quantity: string;
  unitPrice: string;
  amount: string;
  stockBefore: string | null;
  stockAfter: string | null;
  paymentMethod: string;
};

type Props = {
  branches: Branch[];
  products: Product[];
  balances: Balance[];
  canManageInventory: boolean;
};

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: string | number) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

export function InventoryManager({
  branches,
  products,
  balances,
  canManageInventory,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"STOCK" | "ACTIVITY">("STOCK");

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activityDate, setActivityDate] = useState(() =>
    getLocalDateString(new Date()),
  );
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [activitySuccess, setActivitySuccess] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"WEEK" | "MONTH">("WEEK");
  const [reportRows, setReportRows] = useState<ActivityRow[]>([]);
  const [previousReportRows, setPreviousReportRows] = useState<ActivityRow[]>(
    [],
  );
  const [branchComparisonRows, setBranchComparisonRows] = useState<
    ActivityRow[]
  >([]);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportError, setReportError] = useState("");

  const [staffFilter, setStaffFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const branchBalances = useMemo(
    () => balances.filter((balance) => balance.branchId === branchId),
    [balances, branchId],
  );

  const currentBalance = branchBalances.find(
    (balance) => balance.productId === productId,
  );

  const filteredActivity = useMemo(() => {
    return activityRows.filter((row) => {
      const matchesStaff = staffFilter === "ALL" || row.staffId === staffFilter;

      const matchesType = typeFilter === "ALL" || row.type === typeFilter;

      const matchesPayment =
        paymentFilter === "ALL" ||
        row.paymentMethod.split(", ").includes(paymentFilter);

      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !search ||
        row.itemName.toLowerCase().includes(search) ||
        row.staffName.toLowerCase().includes(search) ||
        row.receiptNumber.toLowerCase().includes(search) ||
        row.processedBy.toLowerCase().includes(search);

      return matchesStaff && matchesType && matchesPayment && matchesSearch;
    });
  }, [activityRows, staffFilter, typeFilter, paymentFilter, searchTerm]);

  const performance = useMemo(() => {
    const staffMap = new Map<
      string,
      {
        staffId: string;
        name: string;
        services: number;
        products: number;
        serviceRevenue: number;
        productRevenue: number;
        totalRevenue: number;
      }
    >();

    for (const row of filteredActivity) {
      const key = row.staffId ?? row.staffName;

      const current = staffMap.get(key) ?? {
        staffId: key,
        name: row.staffName,
        services: 0,
        products: 0,
        serviceRevenue: 0,
        productRevenue: 0,
        totalRevenue: 0,
      };

      const amount = Number(row.amount);
      const itemQuantity = Number(row.quantity);

      if (row.type === "SERVICE") {
        current.services += itemQuantity;
        current.serviceRevenue += amount;
      } else {
        current.products += itemQuantity;
        current.productRevenue += amount;
      }

      current.totalRevenue += amount;
      staffMap.set(key, current);
    }

    return [...staffMap.values()].sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );
  }, [filteredActivity]);

  const activitySummary = useMemo(() => {
    return filteredActivity.reduce(
      (summary, row) => {
        const amount = Number(row.amount);
        const quantity = Number(row.quantity);

        summary.revenue += amount;

        if (row.type === "PRODUCT") {
          summary.productQuantity += quantity;
          summary.productRevenue += amount;
        } else {
          summary.serviceQuantity += quantity;
          summary.serviceRevenue += amount;
        }

        return summary;
      },
      {
        revenue: 0,
        productQuantity: 0,
        serviceQuantity: 0,
        productRevenue: 0,
        serviceRevenue: 0,
      },
    );
  }, [filteredActivity]);

  const reportSummary = useMemo(() => {
    function calculate(rows: ActivityRow[]) {
      return rows.reduce(
        (summary, row) => {
          const amount = Number(row.amount);
          const quantity = Number(row.quantity);

          summary.revenue += amount;

          if (row.type === "PRODUCT") {
            summary.productRevenue += amount;
            summary.products += quantity;
          } else {
            summary.serviceRevenue += amount;
            summary.services += quantity;
          }

          return summary;
        },
        {
          revenue: 0,
          productRevenue: 0,
          serviceRevenue: 0,
          products: 0,
          services: 0,
        },
      );
    }

    const current = calculate(reportRows);
    const previous = calculate(previousReportRows);

    const growth =
      previous.revenue === 0
        ? current.revenue > 0
          ? 100
          : 0
        : ((current.revenue - previous.revenue) / previous.revenue) * 100;

    return { current, previous, growth };
  }, [reportRows, previousReportRows]);

  const reportStaffPerformance = useMemo(() => {
    const staffMap = new Map<
      string,
      {
        name: string;
        revenue: number;
        services: number;
        products: number;
      }
    >();

    for (const row of reportRows) {
      const key = row.staffId ?? row.staffName;

      const person = staffMap.get(key) ?? {
        name: row.staffName,
        revenue: 0,
        services: 0,
        products: 0,
      };

      person.revenue += Number(row.amount);

      if (row.type === "SERVICE") {
        person.services += Number(row.quantity);
      } else {
        person.products += Number(row.quantity);
      }

      staffMap.set(key, person);
    }

    return [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);
  }, [reportRows]);

  const branchPerformance = useMemo(() => {
    const branchMap = new Map<
      string,
      {
        name: string;
        revenue: number;
        serviceRevenue: number;
        productRevenue: number;
        services: number;
        products: number;
      }
    >();

    for (const row of branchComparisonRows) {
      const current = branchMap.get(row.branchName) ?? {
        name: row.branchName,
        revenue: 0,
        serviceRevenue: 0,
        productRevenue: 0,
        services: 0,
        products: 0,
      };

      const amount = Number(row.amount);
      const quantity = Number(row.quantity);

      current.revenue += amount;

      if (row.type === "SERVICE") {
        current.serviceRevenue += amount;
        current.services += quantity;
      } else {
        current.productRevenue += amount;
        current.products += quantity;
      }

      branchMap.set(row.branchName, current);
    }

    return [...branchMap.values()].sort((a, b) => b.revenue - a.revenue);
  }, [branchComparisonRows]);

  const crossBranchStaffPerformance = useMemo(() => {
    const staffMap = new Map<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        services: number;
        products: number;
      }
    >();

    for (const row of branchComparisonRows) {
      const key = row.staffId ?? row.staffName;

      const current = staffMap.get(key) ?? {
        id: key,
        name: row.staffName,
        revenue: 0,
        services: 0,
        products: 0,
      };

      current.revenue += Number(row.amount);

      if (row.type === "SERVICE") {
        current.services += Number(row.quantity);
      } else {
        current.products += Number(row.quantity);
      }

      staffMap.set(key, current);
    }

    return [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);
  }, [branchComparisonRows]);

  const staffOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const row of activityRows) {
      if (row.staffId) {
        options.set(row.staffId, row.staffName);
      }
    }

    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activityRows]);

  const paymentOptions = useMemo(() => {
    return [
      ...new Set(
        activityRows.flatMap((row) =>
          row.paymentMethod.split(", ").filter(Boolean),
        ),
      ),
    ];
  }, [activityRows]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!branchId || !productId || quantity.trim() === "") {
      setError("Select a branch, product, and enter a quantity.");
      return;
    }

    startTransition(async () => {
      const result = await setBranchStock({
        branchId,
        productId,
        quantity,
        reason,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess("Stock updated successfully.");
      setQuantity("");
      setReason("");
      router.refresh();
    });
  }

  function handleLoadActivity() {
    setActivityError("");
    setActivitySuccess("");
    setActivityLoaded(false);
    setActivityRows([]);
    setStaffFilter("ALL");
    setTypeFilter("ALL");
    setPaymentFilter("ALL");
    setSearchTerm("");

    if (!branchId || !activityDate) {
      setActivityError("Select a branch and date.");
      return;
    }

    const [year, month, day] = activityDate.split("-").map(Number);

    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);

    startTransition(async () => {
      const result = await getDailyActivity({
        branchId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      });

      if (!result.success) {
        setActivityError(result.error);
        return;
      }

      setActivityRows(result.rows as ActivityRow[]);
      setActivityLoaded(true);
      setActivitySuccess("Daily activity loaded successfully.");
    });
  }

  function handleLoadPeriodReport() {
    setReportError("");
    setReportLoaded(false);

    if (!branchId || !activityDate) {
      setReportError("Select a branch and reference date.");
      return;
    }

    const [year, month, day] = activityDate.split("-").map(Number);
    const anchor = new Date(year, month - 1, day);

    let currentStart: Date;
    let currentEnd: Date;
    let previousStart: Date;
    let previousEnd: Date;

    if (reportPeriod === "WEEK") {
      const mondayOffset = (anchor.getDay() + 6) % 7;

      currentStart = new Date(year, month - 1, day - mondayOffset);
      currentEnd = new Date(year, month - 1, day - mondayOffset + 7);
      previousStart = new Date(year, month - 1, day - mondayOffset - 7);
      previousEnd = new Date(year, month - 1, day - mondayOffset);
    } else {
      currentStart = new Date(year, month - 1, 1);
      currentEnd = new Date(year, month, 1);
      previousStart = new Date(year, month - 2, 1);
      previousEnd = new Date(year, month - 1, 1);
    }

    startTransition(async () => {
      const [currentResult, previousResult] = await Promise.all([
        getDailyActivity({
          branchId,
          startAt: currentStart.toISOString(),
          endAt: currentEnd.toISOString(),
        }),
        getDailyActivity({
          branchId,
          startAt: previousStart.toISOString(),
          endAt: previousEnd.toISOString(),
        }),
      ]);

      if (!currentResult.success || !previousResult.success) {
        setReportError("Unable to load the performance report.");
        return;
      }

      setReportRows(currentResult.rows as ActivityRow[]);
      setPreviousReportRows(previousResult.rows as ActivityRow[]);
      setReportLoaded(true);
    });
  }

  function handleLoadBranchComparison() {
    setReportError("");
    setReportLoaded(false);

    if (!branches.length || !activityDate) {
      setReportError("No accessible branches or reference date selected.");
      return;
    }

    const [year, month, day] = activityDate.split("-").map(Number);
    const anchor = new Date(year, month - 1, day);

    let start: Date;
    let end: Date;

    if (reportPeriod === "WEEK") {
      const mondayOffset = (anchor.getDay() + 6) % 7;
      start = new Date(year, month - 1, day - mondayOffset);
      end = new Date(year, month - 1, day - mondayOffset + 7);
    } else {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 1);
    }

    startTransition(async () => {
      const results = await Promise.all(
        branches.map(async (branch) => ({
          branchId: branch.id,
          result: await getDailyActivity({
            branchId: branch.id,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
          }),
        })),
      );

      const failed = results.some(({ result }) => !result.success);

      if (failed) {
        setReportError(
          "Unable to compare all branches. Check your branch access and try again.",
        );
        return;
      }

      const rows = results.flatMap(({ result }) =>
        result.success ? (result.rows as ActivityRow[]) : [],
      );

      setBranchComparisonRows(rows);
      setReportLoaded(true);
    });
  }

  function handleExportExcel() {
    if (filteredActivity.length === 0) {
      setActivityError("There are no records to export.");
      return;
    }

    const exportData = filteredActivity.map((row) => ({
      Date: new Date(row.timestamp).toLocaleDateString(),
      Time: new Date(row.timestamp).toLocaleTimeString(),
      Branch: row.branchName,
      Staff: row.staffName,
      Item: row.itemName,
      Type: row.type,
      Quantity: Number(row.quantity),
      UnitPrice: Number(row.unitPrice),
      Amount: Number(row.amount),
      PaymentMethod: row.paymentMethod,
      StockBefore: row.stockBefore ? Number(row.stockBefore) : "",
      StockAfter: row.stockAfter ? Number(row.stockAfter) : "",
      ReceiptNumber: row.receiptNumber,
      ProcessedBy: row.processedBy,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Activity");

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 22 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 22 },
      { wch: 22 },
    ];

    XLSX.writeFile(workbook, `daily-activity-${activityDate}.xlsx`);
  }

  return (
    <div className="inventory-page space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage stock and monitor daily staff sales activity.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("STOCK")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === "STOCK"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Stock Management
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACTIVITY")}
          className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === "ACTIVITY"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Daily Activity
        </button>
      </div>

      {activeTab === "STOCK" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border bg-card p-4">
              <p className="text-sm text-muted-foreground">Products tracked</p>
              <p className="mt-2 text-2xl font-semibold">
                {branchBalances.length}
              </p>
            </div>

            <div className="border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total units</p>
              <p className="mt-2 text-2xl font-semibold">
                {branchBalances
                  .reduce(
                    (total, balance) => total + Number(balance.quantity),
                    0,
                  )
                  .toLocaleString()}
              </p>
            </div>

            <div className="border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Products available
              </p>
              <p className="mt-2 text-2xl font-semibold">{products.length}</p>
            </div>
          </div>

          {canManageInventory && (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 border bg-card p-5"
            >
              <div>
                <h2 className="font-semibold">Update stock</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the new physical stock quantity for a product at a
                  branch.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Branch" htmlFor="inventory-branch" required>
                  <Select
                    id="inventory-branch"
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Product" htmlFor="inventory-product" required>
                  <Select
                    id="inventory-product"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  label="New stock quantity"
                  htmlFor="inventory-quantity"
                  required
                  description={
                    currentBalance
                      ? `Current stock: ${currentBalance.quantity} units`
                      : "No existing stock. This will create opening stock."
                  }
                >
                  <Input
                    id="inventory-quantity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Enter quantity"
                  />
                </FormField>

                <FormField label="Reason" htmlFor="inventory-reason">
                  <Input
                    id="inventory-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="e.g. Initial stock count"
                  />
                </FormField>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-green-700" role="status">
                  {success}
                </p>
              )}

              <Button
                type="submit"
                disabled={isPending || !branches.length || !products.length}
              >
                {isPending ? "Saving..." : "Save stock"}
              </Button>
            </form>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold">Stock balances</h2>

              <div className="w-full sm:max-w-xs">
                <Select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Last updated</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {branchBalances.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No stock recorded for this branch yet.
                      </td>
                    </tr>
                  ) : (
                    branchBalances.map((balance) => (
                      <tr key={balance.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {balance.productName}
                        </td>
                        <td className="px-4 py-3">{balance.sku}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {balance.quantity}
                        </td>
                        <td className="px-4 py-3">
                          {new Date(balance.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge>
                            {Number(balance.quantity) > 0
                              ? "IN STOCK"
                              : "OUT OF STOCK"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ACTIVITY" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">
              Daily Staff Activity Register
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review completed sales, staff contributions, payment methods and
              product stock movement.
            </p>
          </div>

          <div className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-3">
            <FormField label="Branch" htmlFor="activity-branch" required>
              <Select
                id="activity-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Activity date" htmlFor="activity-date" required>
              <Input
                id="activity-date"
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </FormField>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleLoadActivity}
                disabled={isPending || !branchId}
              >
                {isPending ? "Loading..." : "Load daily register"}
              </Button>
            </div>
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-5">
            <div>
              <h3 className="text-lg font-semibold">
                Weekly & Monthly Performance
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare revenue, sales and staff performance against the
                previous period.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Report period" htmlFor="report-period">
                <Select
                  id="report-period"
                  value={reportPeriod}
                  onChange={(event) =>
                    setReportPeriod(event.target.value as "WEEK" | "MONTH")
                  }
                >
                  <option value="WEEK">Weekly</option>
                  <option value="MONTH">Monthly</option>
                </Select>
              </FormField>

              <Button
                type="button"
                onClick={handleLoadPeriodReport}
                disabled={isPending || !branchId}
              >
                {isPending ? "Loading..." : "Generate report"}
              </Button>
            </div>

            {reportError && (
              <p className="text-sm text-destructive" role="alert">
                {reportError}
              </p>
            )}

            {reportLoaded && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Current revenue
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatMoney(reportSummary.current.revenue)}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Previous revenue
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatMoney(reportSummary.previous.revenue)}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Revenue change
                    </p>
                    <p
                      className={`mt-2 text-xl font-semibold ${
                        reportSummary.growth >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {reportSummary.growth > 0 ? "+" : ""}
                      {reportSummary.growth.toFixed(1)}%
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Services / Products
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatQuantity(reportSummary.current.services)} /{" "}
                      {formatQuantity(reportSummary.current.products)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Service revenue
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatMoney(reportSummary.current.serviceRevenue)}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Product revenue
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatMoney(reportSummary.current.productRevenue)}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">
                    Staff performance ranking
                  </h4>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b text-left">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Staff member</th>
                          <th className="px-4 py-3">Services</th>
                          <th className="px-4 py-3">Products</th>
                          <th className="px-4 py-3">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportStaffPerformance.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-6 text-center text-muted-foreground"
                            >
                              No performance records for this period.
                            </td>
                          </tr>
                        ) : (
                          reportStaffPerformance.map((person, index) => (
                            <tr
                              key={person.name}
                              className="border-b last:border-0"
                            >
                              <td className="px-4 py-3">{index + 1}</td>
                              <td className="px-4 py-3 font-medium">
                                {person.name}
                                {index === 0 && (
                                  <Badge variant="success">Top performer</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {formatQuantity(person.services)}
                              </td>
                              <td className="px-4 py-3">
                                {formatQuantity(person.products)}
                              </td>
                              <td className="px-4 py-3 font-semibold">
                                {formatMoney(person.revenue)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-5 rounded-lg border bg-card p-5">
            <div>
              <h3 className="text-lg font-semibold">
                Multi-Branch Performance Comparison
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare every accessible branch for the selected weekly or
                monthly reporting period.
              </p>
            </div>

            <Button
              type="button"
              onClick={handleLoadBranchComparison}
              disabled={isPending || !branches.length}
            >
              {isPending ? "Loading..." : "Compare all branches"}
            </Button>

            {branchComparisonRows.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Best-performing branch
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {branchPerformance[0]?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(branchPerformance[0]?.revenue ?? 0)} revenue
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">
                      Top staff member across branches
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {crossBranchStaffPerformance[0]?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(
                        crossBranchStaffPerformance[0]?.revenue ?? 0,
                      )}{" "}
                      revenue
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">Branch performance</h4>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[750px] text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b text-left">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Branch</th>
                          <th className="px-4 py-3">Services</th>
                          <th className="px-4 py-3">Products</th>
                          <th className="px-4 py-3">Service revenue</th>
                          <th className="px-4 py-3">Product revenue</th>
                          <th className="px-4 py-3">Total revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchPerformance.map((branch, index) => (
                          <tr
                            key={branch.name}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3 font-medium">
                              {branch.name}
                              {index === 0 && (
                                <Badge variant="success">Top branch</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(branch.services)}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(branch.products)}
                            </td>
                            <td className="px-4 py-3">
                              {formatMoney(branch.serviceRevenue)}
                            </td>
                            <td className="px-4 py-3">
                              {formatMoney(branch.productRevenue)}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatMoney(branch.revenue)}
                            </td>
                          </tr>
                        ))}
                        {branchPerformance.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-6 text-center text-muted-foreground"
                            >
                              No branch sales found for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">
                    Staff ranking across all branches
                  </h4>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b text-left">
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Staff member</th>
                          <th className="px-4 py-3">Services</th>
                          <th className="px-4 py-3">Products</th>
                          <th className="px-4 py-3">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crossBranchStaffPerformance.map((person, index) => (
                          <tr
                            key={person.id}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-3">{index + 1}</td>
                            <td className="px-4 py-3 font-medium">
                              {person.name}
                              {index === 0 && (
                                <Badge variant="success">Top performer</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(person.services)}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(person.products)}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {formatMoney(person.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {branchComparisonRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Generate a comparison to see branch and staff rankings.
              </p>
            )}
          </div>

          {activityError && (
            <p className="text-sm text-destructive" role="alert">
              {activityError}
            </p>
          )}

          {activitySuccess && (
            <p className="text-sm text-green-700" role="status">
              {activitySuccess}
            </p>
          )}

          {activityLoaded && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Item revenue</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatMoney(activitySummary.revenue)}
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Service revenue
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatMoney(activitySummary.serviceRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatQuantity(activitySummary.serviceQuantity)} services
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Product revenue
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {formatMoney(activitySummary.productRevenue)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatQuantity(activitySummary.productQuantity)} units sold
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Transaction lines
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {filteredActivity.length}
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border bg-card p-5">
                <div>
                  <h3 className="font-semibold">Register filters</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Narrow the register to a particular staff member, item type
                    or payment method.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Staff member" htmlFor="activity-staff">
                    <Select
                      id="activity-staff"
                      value={staffFilter}
                      onChange={(event) => setStaffFilter(event.target.value)}
                    >
                      <option value="ALL">All staff</option>
                      {staffOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Item type" htmlFor="activity-type">
                    <Select
                      id="activity-type"
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                    >
                      <option value="ALL">All items</option>
                      <option value="SERVICE">Services</option>
                      <option value="PRODUCT">Products</option>
                    </Select>
                  </FormField>

                  <FormField label="Payment method" htmlFor="activity-payment">
                    <Select
                      id="activity-payment"
                      value={paymentFilter}
                      onChange={(event) => setPaymentFilter(event.target.value)}
                    >
                      <option value="ALL">All methods</option>
                      {paymentOptions.map((method) => (
                        <option key={method} value={method}>
                          {method.replaceAll("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Search" htmlFor="activity-search">
                    <Input
                      id="activity-search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Staff, item or receipt..."
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Staff performance</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Performance based on the currently filtered register.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b text-left">
                        <th className="px-4 py-3 font-medium">Staff member</th>
                        <th className="px-4 py-3 font-medium">Services</th>
                        <th className="px-4 py-3 font-medium">Products</th>
                        <th className="px-4 py-3 font-medium">
                          Service revenue
                        </th>
                        <th className="px-4 py-3 font-medium">
                          Product revenue
                        </th>
                        <th className="px-4 py-3 font-medium">Total value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            No staff performance records found.
                          </td>
                        </tr>
                      ) : (
                        performance.map((person) => (
                          <tr
                            key={person.staffId}
                            className="border-b last:border-0"
                          >
                            <td className="px-4 py-3 font-medium">
                              {person.name}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(person.services)}
                            </td>
                            <td className="px-4 py-3">
                              {formatQuantity(person.products)}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {formatMoney(person.serviceRevenue)}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {formatMoney(person.productRevenue)}
                            </td>
                            <td className="px-4 py-3 font-semibold tabular-nums">
                              {formatMoney(person.totalRevenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      Daily transaction register
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {filteredActivity.length} matching transaction lines
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleExportExcel}
                      disabled={filteredActivity.length === 0}
                    >
                      Export to Excel
                    </Button>

                    <Button type="button" onClick={() => window.print()}>
                      Print register
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[1150px] text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b text-left">
                        <th className="px-3 py-3 font-medium">Time</th>
                        <th className="px-3 py-3 font-medium">Staff</th>
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Type</th>
                        <th className="px-3 py-3 font-medium">Quantity</th>
                        <th className="px-3 py-3 font-medium">Amount</th>
                        <th className="px-3 py-3 font-medium">Payment</th>
                        <th className="px-3 py-3 font-medium">Stock before</th>
                        <th className="px-3 py-3 font-medium">Stock after</th>
                        <th className="px-3 py-3 font-medium">Receipt</th>
                        <th className="px-3 py-3 font-medium">Processed by</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredActivity.length === 0 ? (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-10 text-center text-muted-foreground"
                          >
                            No completed sales found for these filters.
                          </td>
                        </tr>
                      ) : (
                        filteredActivity.map((row) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="whitespace-nowrap px-3 py-3">
                              {new Date(row.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {row.staffName}
                            </td>
                            <td className="px-3 py-3">{row.itemName}</td>
                            <td className="px-3 py-3">
                              <Badge
                                variant={
                                  row.type === "PRODUCT" ? "default" : "success"
                                }
                              >
                                {row.type}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {formatQuantity(row.quantity)}
                            </td>
                            <td className="px-3 py-3 font-medium tabular-nums">
                              {formatMoney(Number(row.amount))}
                            </td>
                            <td className="px-3 py-3">
                              {row.paymentMethod.replaceAll("_", " ")}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {row.type === "PRODUCT"
                                ? (row.stockBefore ?? "—")
                                : "—"}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {row.type === "PRODUCT"
                                ? (row.stockAfter ?? "—")
                                : "—"}
                            </td>
                            <td className="px-3 py-3">{row.receiptNumber}</td>
                            <td className="px-3 py-3">{row.processedBy}</td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    {filteredActivity.length > 0 && (
                      <tfoot className="bg-muted/50">
                        <tr>
                          <td colSpan={5} className="px-3 py-3 font-semibold">
                            Filtered item revenue
                          </td>
                          <td className="px-3 py-3 font-semibold tabular-nums">
                            {formatMoney(activitySummary.revenue)}
                          </td>
                          <td colSpan={5} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}

          {!activityLoaded && !activityError && (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <h3 className="font-medium">Your daily register is ready</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a branch and date, then load the register to view
                completed transactions and staff performance.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
