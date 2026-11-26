"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createManualBranch,
  createManualStaff,
  saveManualPerformanceEntry,
  setManualBranchStatus,
  setManualStaffStatus,
} from "@/app/actions/manual-performance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";

type Staff = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
};

type Branch = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  staff: Staff[];
};

type Entry = {
  id: string;
  branchId: string;
  branchName: string;
  staffId: string;
  staffName: string;
  workDate: string;
  revenue: number;
  notes: string | null;
};

type Props = {
  branches: Branch[];
  entries: Entry[];
};

const inputClass =
  "h-10 w-full rounded-lg border border-[#DDE2DA] bg-[#FBFAF7] px-3 text-sm text-[#39443B] outline-none focus:border-[#829783] focus:ring-2 focus:ring-[#829783]/15";

const panelClass =
  "overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(35,45,35,0.03)]";

function localDate() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getRange(period: string, start: string, end: string) {
  const today = new Date();

  if (period === "CUSTOM") return { start, end };
  if (period === "ALL") return { start: "0000-01-01", end: "9999-12-31" };

  if (period === "DAILY") {
    return { start: localDate(), end: localDate() };
  }

  if (period === "WEEKLY") {
    const first = new Date(today);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));

    const last = new Date(first);
    last.setDate(first.getDate() + 6);

    return { start: dateKey(first), end: dateKey(last) };
  }

  return {
    start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: dateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

export function ManualPerformanceManager({ branches, entries }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "overview" | "entry" | "branches" | "reports"
  >("overview");

  const [branchName, setBranchName] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchAddress, setBranchAddress] = useState("");

  const [staffBranch, setStaffBranch] = useState(
    branches.find((b) => b.isActive)?.id ?? "",
  );
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");

  const [entryBranch, setEntryBranch] = useState(
    branches.find((b) => b.isActive)?.id ?? "",
  );
  const [entryStaff, setEntryStaff] = useState("");
  const [workDate, setWorkDate] = useState(localDate());
  const [revenue, setRevenue] = useState("");
  const [notes, setNotes] = useState("");

  const [period, setPeriod] = useState("DAILY");
  const [customStart, setCustomStart] = useState(localDate());
  const [customEnd, setCustomEnd] = useState(localDate());
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStaff, setFilterStaff] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeBranches = branches.filter((branch) => branch.isActive);

  const selectedEntryBranch = activeBranches.find(
    (branch) => branch.id === entryBranch,
  );

  const availableEntryStaff =
    selectedEntryBranch?.staff.filter((staff) => staff.isActive) ?? [];

  const selectedStaffBranch = activeBranches.find(
    (branch) => branch.id === staffBranch,
  );

  const availableStaff = selectedStaffBranch?.staff ?? [];

  const range = useMemo(
    () => getRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  );

  const filteredEntries = useMemo(() => {
    if (
      period === "CUSTOM" &&
      (!customStart || !customEnd || customStart > customEnd)
    ) {
      return [];
    }

    return entries.filter((entry) => {
      if (filterBranch && entry.branchId !== filterBranch) return false;
      if (filterStaff && entry.staffId !== filterStaff) return false;

      return entry.workDate >= range.start && entry.workDate <= range.end;
    });
  }, [
    entries,
    filterBranch,
    filterStaff,
    range,
    period,
    customStart,
    customEnd,
  ]);

  const totalRevenue = filteredEntries.reduce(
    (sum, entry) => sum + entry.revenue,
    0,
  );

  const todayRevenue = entries
    .filter((entry) => entry.workDate === localDate())
    .reduce((sum, entry) => sum + entry.revenue, 0);

  const allTimeRevenue = entries.reduce((sum, entry) => sum + entry.revenue, 0);

  const activeStaffCount = activeBranches.reduce(
    (sum, branch) =>
      sum + branch.staff.filter((staff) => staff.isActive).length,
    0,
  );

  const staffTotals = useMemo(() => {
    const totals = new Map<
      string,
      { name: string; total: number; count: number }
    >();

    filteredEntries.forEach((entry) => {
      const current = totals.get(entry.staffId) ?? {
        name: entry.staffName,
        total: 0,
        count: 0,
      };

      current.total += entry.revenue;
      current.count += 1;

      totals.set(entry.staffId, current);
    });

    return Array.from(totals.values()).sort((a, b) => b.total - a.total);
  }, [filteredEntries]);

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

  function submit(
    action: () => Promise<
      { success: true; message: string } | { success: false; error: string }
    >,
  ) {
    setError("");
    setSuccess("");

    startTransition(async () => showResult(await action()));
  }

  function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    submit(async () => {
      const result = await createManualBranch({
        name: branchName,
        phone: branchPhone,
        address: branchAddress,
      });

      if (result.success) {
        setBranchName("");
        setBranchPhone("");
        setBranchAddress("");
      }

      return result;
    });
  }

  function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    submit(async () => {
      const result = await createManualStaff({
        branchId: staffBranch,
        name: staffName,
        phone: staffPhone,
      });

      if (result.success) {
        setStaffName("");
        setStaffPhone("");
      }

      return result;
    });
  }

  function handleSaveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    submit(async () => {
      const result = await saveManualPerformanceEntry({
        branchId: entryBranch,
        staffId: entryStaff,
        workDate,
        revenue: Number(revenue),
        notes,
      });

      if (result.success) {
        setRevenue("");
        setNotes("");
      }

      return result;
    });
  }

  function toggleBranch(branchId: string, isActive: boolean) {
    submit(() => setManualBranchStatus(branchId, isActive));
  }

  function toggleStaff(staffId: string, isActive: boolean) {
    submit(() => setManualStaffStatus(staffId, isActive));
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "entry", label: "Daily Entry" },
    { id: "branches", label: "Branches & Staff" },
    { id: "reports", label: "Reports" },
  ] as const;

  return (
    <main className="space-y-6">
      {/* Page heading - stays visible on every tab */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#354137]">
          Manual Performance
        </h1>
        <p className="mt-1 text-sm text-[#7C857B]">
          Track daily revenue generated by staff at branches operating outside
          the software.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 border-b border-[#E3E5DD] pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[#617968] text-white"
                : "bg-[#F1F2EC] text-[#687268] hover:bg-[#E7EAE2]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages remain visible on every tab */}
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

      {/* Important notice */}
      <div className="rounded-lg border border-[#E7DCC1] bg-[#FBF7EC] px-4 py-3 text-xs text-[#806B43]">
        These are manually reported external revenue figures. They are separate
        from verified POS sales, accounting and normal reports.
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[#3D493F]">
              Performance overview
            </h2>
            <p className="mt-1 text-xs text-[#858E84]">
              A quick summary of your manually recorded branch performance.
            </p>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={`${panelClass} p-5`}>
              <p className="text-xs text-[#7C857B]">Total recorded revenue</p>
              <p className="mt-2 text-xl font-semibold text-[#354137]">
                {money(allTimeRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-[#929A91]">
                All recorded dates
              </p>
            </div>

            <div className={`${panelClass} p-5`}>
              <p className="text-xs text-[#7C857B]">Today's revenue</p>
              <p className="mt-2 text-xl font-semibold text-[#354137]">
                {money(todayRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-[#929A91]">
                Recorded for today
              </p>
            </div>

            <div className={`${panelClass} p-5`}>
              <p className="text-xs text-[#7C857B]">Manual branches</p>
              <p className="mt-2 text-xl font-semibold text-[#354137]">
                {activeBranches.length}
              </p>
              <p className="mt-1 text-[11px] text-[#929A91]">Active branches</p>
            </div>

            <div className={`${panelClass} p-5`}>
              <p className="text-xs text-[#7C857B]">Active staff</p>
              <p className="mt-2 text-xl font-semibold text-[#354137]">
                {activeStaffCount}
              </p>
              <p className="mt-1 text-[11px] text-[#929A91]">
                Across active branches
              </p>
            </div>
          </section>

          <section className={panelClass}>
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#3D493F]">
                Recent performance entries
              </h2>
              <p className="mt-1 text-xs text-[#858E84]">
                Your latest manually recorded revenue.
              </p>
            </div>

            {entries.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium text-[#687268]">
                  No performance records yet
                </p>
                <p className="mt-1 text-xs text-[#929A91]">
                  Start by recording a staff member's daily revenue.
                </p>
                <Button
                  type="button"
                  onClick={() => setActiveTab("entry")}
                  className="mt-4 h-9 rounded-lg bg-[#617968] px-4 text-xs text-white hover:bg-[#526957]"
                >
                  Add daily entry
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-[#E8E9E2] bg-[#F4F4EE]">
                    <tr>
                      {["Date", "Branch", "Staff", "Revenue"].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEDE7]">
                    {[...entries]
                      .sort((a, b) => b.workDate.localeCompare(a.workDate))
                      .slice(0, 5)
                      .map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F5F6F1]">
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#687268]">
                            {entry.workDate}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[#465247]">
                            {entry.branchName}
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-[#465247]">
                            {entry.staffName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold tabular-nums text-[#39443B]">
                            {money(entry.revenue)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => setActiveTab("entry")}
              className="h-10 rounded-lg bg-[#617968] px-5 text-xs text-white hover:bg-[#526957]"
            >
              Record daily revenue
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("reports")}
              className="h-10 rounded-lg px-5 text-xs"
            >
              View reports
            </Button>
          </div>
        </div>
      )}

      {/* DAILY ENTRY TAB */}
      {activeTab === "entry" && (
        <section className={panelClass}>
          <div className="border-b border-[#E8E9E2] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#3D493F]">
              Daily revenue entry
            </h2>
            <p className="mt-1 text-xs text-[#858E84]">
              Enter each staff member's total external revenue for the workday.
            </p>
          </div>

          <form
            onSubmit={handleSaveEntry}
            className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FormField label="Branch" required>
              <Select
                value={entryBranch}
                onChange={(e) => {
                  setEntryBranch(e.target.value);
                  setEntryStaff("");
                }}
                className={inputClass}
              >
                <option value="">Select branch</option>
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Staff member" required>
              <Select
                value={entryStaff}
                onChange={(e) => setEntryStaff(e.target.value)}
                className={inputClass}
              >
                <option value="">Select staff</option>
                {availableEntryStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Work date" required>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                required
                className={inputClass}
              />
            </FormField>

            <FormField label="Total revenue" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                required
                placeholder="0.00"
                className={inputClass}
              />
            </FormField>

            <FormField label="Notes">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className={inputClass}
              />
            </FormField>

            <div className="flex items-end justify-end">
              <Button
                type="submit"
                disabled={pending || !entryBranch || !entryStaff}
                className="h-10 rounded-lg bg-[#617968] px-5 text-xs text-white hover:bg-[#526957]"
              >
                {pending ? "Saving..." : "Save daily revenue"}
              </Button>
            </div>

            <p className="text-[11px] text-[#929A91] sm:col-span-2 lg:col-span-3">
              Saving again for the same staff member and date updates that day's
              entry instead of creating a duplicate.
            </p>
          </form>
        </section>
      )}

      {/* BRANCHES & STAFF TAB */}
      {activeTab === "branches" && (
        <div className="space-y-5">
          {/* Create branch */}
          <section className={panelClass}>
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#3D493F]">
                Create manual branch
              </h2>
              <p className="mt-1 text-xs text-[#858E84]">
                Register a branch that is not connected to the software.
              </p>
            </div>

            <form
              onSubmit={handleCreateBranch}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <FormField label="Branch name" required>
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  required
                  placeholder="Branch name"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Phone">
                <Input
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="Phone number"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Address">
                <Input
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="Branch address"
                  className={inputClass}
                />
              </FormField>

              <div className="flex items-end justify-end">
                <Button
                  type="submit"
                  disabled={pending}
                  className="h-10 rounded-lg bg-[#617968] px-5 text-xs text-white hover:bg-[#526957]"
                >
                  {pending ? "Saving..." : "Create branch"}
                </Button>
              </div>
            </form>
          </section>

          {/* Add staff */}
          <section className={panelClass}>
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#3D493F]">
                Add manual staff
              </h2>
              <p className="mt-1 text-xs text-[#858E84]">
                These staff records do not have login accounts or software
                permissions.
              </p>
            </div>

            <form
              onSubmit={handleCreateStaff}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <FormField label="Branch" required>
                <Select
                  value={staffBranch}
                  onChange={(e) => setStaffBranch(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select branch</option>
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Staff name" required>
                <Input
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  required
                  placeholder="Staff full name"
                  className={inputClass}
                />
              </FormField>

              <FormField label="Phone">
                <Input
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  placeholder="Phone number"
                  className={inputClass}
                />
              </FormField>

              <div className="flex items-end justify-end">
                <Button
                  type="submit"
                  disabled={pending || !staffBranch}
                  className="h-10 rounded-lg bg-[#617968] px-5 text-xs text-white hover:bg-[#526957]"
                >
                  {pending ? "Saving..." : "Add staff"}
                </Button>
              </div>
            </form>
          </section>

          {/* Manage branches and staff */}
          <section className={panelClass}>
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#3D493F]">
                Manage manual branches and staff
              </h2>
              <p className="mt-1 text-xs text-[#858E84]">
                Archived records remain available in historical reports.
              </p>
            </div>

            <div className="divide-y divide-[#ECEDE7]">
              {branches.map((branch) => (
                <div key={branch.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#465247]">
                        {branch.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[#929A91]">
                        {branch.phone || "No phone"}
                        {branch.address ? ` · ${branch.address}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={branch.isActive ? "success" : "muted"}>
                        {branch.isActive ? "Active" : "Archived"}
                      </Badge>

                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          toggleBranch(branch.id, !branch.isActive)
                        }
                      >
                        {branch.isActive ? "Archive" : "Activate"}
                      </Button>
                    </div>
                  </div>

                  {branch.staff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#F6F7F2] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-medium text-[#465247]">
                          {staff.name}
                        </p>
                        <p className="mt-1 text-[11px] text-[#929A91]">
                          {staff.phone || "No phone"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={staff.isActive ? "success" : "muted"}>
                          {staff.isActive ? "Active" : "Archived"}
                        </Badge>

                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={pending}
                          onClick={() => toggleStaff(staff.id, !staff.isActive)}
                        >
                          {staff.isActive ? "Archive" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {branch.staff.length === 0 && (
                    <p className="text-xs text-[#929A91]">
                      No staff registered for this branch.
                    </p>
                  )}
                </div>
              ))}

              {branches.length === 0 && (
                <p className="p-5 text-xs text-[#929A91]">
                  No manual branches created yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <div className="space-y-5">
          <section className={panelClass}>
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2 className="text-sm font-semibold text-[#3D493F]">
                Performance report
              </h2>
              <p className="mt-1 text-xs text-[#858E84]">
                Review external revenue by period, branch and staff member.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Period">
                  <Select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className={inputClass}
                  >
                    <option value="DAILY">Today</option>
                    <option value="WEEKLY">This week</option>
                    <option value="MONTHLY">This month</option>
                    <option value="CUSTOM">Custom dates</option>
                    <option value="ALL">All recorded dates</option>
                  </Select>
                </FormField>

                <FormField label="Branch">
                  <Select
                    value={filterBranch}
                    onChange={(e) => {
                      setFilterBranch(e.target.value);
                      setFilterStaff("");
                    }}
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

                <FormField label="Staff member">
                  <Select
                    value={filterStaff}
                    onChange={(e) => setFilterStaff(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">All staff</option>
                    {branches
                      .filter((b) => !filterBranch || b.id === filterBranch)
                      .flatMap((branch) =>
                        branch.staff.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} — {branch.name}
                          </option>
                        )),
                      )}
                  </Select>
                </FormField>

                {period === "CUSTOM" && (
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="From">
                      <Input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="To">
                      <Input
                        type="date"
                        min={customStart}
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className={inputClass}
                      />
                    </FormField>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#7C857B]">
                    Total external revenue
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#354137]">
                    {money(totalRevenue)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#7C857B]">
                    Staff recorded
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#354137]">
                    {staffTotals.length}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#7C857B]">
                    Daily records
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[#354137]">
                    {filteredEntries.length}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E8E9E2] bg-[#F9F9F5] p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#465247]">
                  Revenue by staff
                </h3>

                {staffTotals.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[#929A91]">
                    No performance records for this period.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {staffTotals.map((staff) => (
                      <div
                        key={staff.name}
                        className="flex items-center justify-between gap-3 border-b border-[#E8E9E2] pb-3 last:border-0"
                      >
                        <div>
                          <p className="text-xs font-medium text-[#465247]">
                            {staff.name}
                          </p>
                          <p className="mt-1 text-[11px] text-[#929A91]">
                            {staff.count} daily records
                          </p>
                        </div>

                        <p className="text-xs font-semibold tabular-nums text-[#354137]">
                          {money(staff.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Daily history */}
          <section className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E9E2] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[#3D493F]">
                  Daily performance history
                </h2>
                <p className="mt-1 text-xs text-[#858E84]">
                  Individual daily revenue entries.
                </p>
              </div>

              <Badge variant="muted">{filteredEntries.length} records</Badge>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="px-5 py-12 text-center text-xs text-[#929A91]">
                No records found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-[#E8E9E2] bg-[#F4F4EE]">
                    <tr>
                      {["Date", "Branch", "Staff", "Revenue", "Notes"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#ECEDE7]">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-[#F5F6F1]">
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#687268]">
                          {entry.workDate}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-[#465247]">
                          {entry.branchName}
                        </td>

                        <td className="px-4 py-3.5 text-xs font-medium text-[#465247]">
                          {entry.staffName}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs font-semibold tabular-nums text-[#39443B]">
                          {money(entry.revenue)}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-[#858E84]">
                          {entry.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
