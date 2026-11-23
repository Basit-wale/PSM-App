"use client";

import { useState, useTransition, type FormEvent } from "react";

import {
  createJournalEntry,
  createLedgerAccount,
  postJournalEntry,
} from "@/app/actions/accounting";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "../ui/badge";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  isSystem: boolean;
};

type JournalLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  debit: string;
  credit: string;
};

type JournalEntry = {
  id: string;
  entryNumber: string;
  description: string;
  reference: string | null;
  status: string;
  entryDate: string;
  postedAt: string | null;
  branchName: string;
  lines: JournalLine[];
};

type Branch = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  accounts: Account[];
  entries: JournalEntry[];
  branches: Branch[];
  currency: string;
  canManage: boolean;
};

type EntryLineInput = {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
};

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function AccountingManager({
  accounts,
  entries,
  branches,
  currency,
  canManage,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [accountList] = useState(accounts);
  const [entryList, setEntryList] = useState(entries);

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("EXPENSE");
  const [accountDescription, setAccountDescription] = useState("");

  const [branchId, setBranchId] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [reference, setReference] = useState("");

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const [lines, setLines] = useState<EntryLineInput[]>([
    { accountId: "", description: "", debit: "0", credit: "0" },
    { accountId: "", description: "", debit: "0", credit: "0" },
  ]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"entries" | "accounts">("entries");

  const activeAccounts = accountList.filter((account) => account.isActive);

  const totalDebit = lines.reduce(
    (sum, line) => sum + (Number(line.debit) || 0),
    0,
  );

  const totalCredit = lines.reduce(
    (sum, line) => sum + (Number(line.credit) || 0),
    0,
  );

  function showResult(success: boolean, text: string) {
    setMessage(success ? text : "");
    setError(success ? "" : text);
  }

  function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await createLedgerAccount({
        code: accountCode,
        name: accountName,
        type: accountType,
        description: accountDescription,
      });

      showResult(
        result.success,
        result.success ? result.message : result.error,
      );

      if (result.success) {
        window.location.reload();
      }
    });
  }

  function updateLine(
    index: number,
    field: keyof EntryLineInput,
    value: string,
  ) {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      { accountId: "", description: "", debit: "0", credit: "0" },
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await createJournalEntry({
        branchId,
        description: entryDescription,
        reference,
        entryDate,
        lines,
      });

      showResult(
        result.success,
        result.success ? result.message : result.error,
      );

      if (result.success) {
        window.location.reload();
      }
    });
  }

  function handlePostEntry(entryId: string) {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await postJournalEntry(entryId);

      showResult(
        result.success,
        result.success ? result.message : result.error,
      );

      if (result.success) {
        setEntryList((current) =>
          current.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  status: "POSTED",
                  postedAt: new Date().toISOString(),
                }
              : entry,
          ),
        );
      }
    });
  }

  const draftCount = entryList.filter(
    (entry) => entry.status === "DRAFT",
  ).length;

  const postedCount = entryList.filter(
    (entry) => entry.status === "POSTED",
  ).length;

  return (
    <div className="accounting-page space-y-7">
      {/* Page heading */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#829987]">
            Finance & bookkeeping
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#263D3C]">
            Accounting
          </h1>
          <p className="mt-1 text-sm text-[#78847C]">
            Manage your chart of accounts and journal entries.
          </p>
        </div>

        <div className="rounded-lg border border-[#DFE3D9] bg-[#EFF0E9] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[#78847C]">
            Accounting records
          </p>
          <p className="mt-1 text-sm font-semibold text-[#263D3C]">
            {entryList.length} journal entries
          </p>
        </div>
      </div>

      {/* Feedback messages */}
      {message && (
        <div className="rounded-lg border border-[#C9D9CB] bg-[#EDF4EC] p-4 text-sm text-[#365B43]">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-[#E2E1D8] bg-[#FBFAF7] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#78847C]">
              Ledger accounts
            </p>
            <span className="rounded-lg bg-[#EFF0E9] px-2.5 py-2 text-xs text-[#617C68]">
              Accounts
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#263D3C]">
            {accountList.length}
          </p>
          <p className="mt-1 text-xs text-[#8A948B]">
            Total accounts in your ledger
          </p>
        </div>

        <div className="rounded-xl border border-[#D4DDD2] bg-[#F6F7F1] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#78847C]">
              Journal entries
            </p>
            <span className="rounded-lg bg-[#E5ECE3] px-2.5 py-2 text-xs text-[#617C68]">
              Entries
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#263D3C]">
            {entryList.length}
          </p>
          <p className="mt-1 text-xs text-[#8A948B]">
            Total recorded transactions
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E1D8] bg-[#FBFAF7] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#78847C]">Draft entries</p>
            <span className="rounded-lg bg-[#F1EEE3] px-2.5 py-2 text-xs text-[#927A43]">
              Pending
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-[#263D3C]">
            {draftCount}
          </p>
          <p className="mt-1 text-xs text-[#8A948B]">
            {postedCount} posted entries
          </p>
        </div>
      </section>

      {/* Create journal entry */}
      {canManage && (
        <section className="overflow-hidden rounded-xl border border-[#E2E1D8] bg-[#FBFAF7]">
          <div className="border-b border-[#E8E7DF] px-5 py-5 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#829987]">
              New transaction
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#263D3C]">
              Create journal entry
            </h2>
            <p className="mt-1 text-sm text-[#78847C]">
              Record a balanced transaction using debit and credit lines.
            </p>
          </div>

          <form onSubmit={handleCreateEntry} className="space-y-6 p-5 sm:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-[#52645A]"
                  htmlFor="entry-description"
                >
                  Description
                </label>
                <Input
                  id="entry-description"
                  value={entryDescription}
                  onChange={(event) => setEntryDescription(event.target.value)}
                  placeholder="e.g. Monthly rent payment"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-[#52645A]"
                  htmlFor="entry-reference"
                >
                  Reference (optional)
                </label>
                <Input
                  id="entry-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Invoice or transaction reference"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-[#52645A]"
                  htmlFor="entry-date"
                >
                  Entry date
                </label>
                <Input
                  id="entry-date"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs font-medium text-[#52645A]"
                  htmlFor="entry-branch"
                >
                  Branch
                </label>
                <Select
                  id="entry-branch"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                >
                  <option value="">Organization-wide</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Journal lines */}
            <div className="border-t border-[#E8E7DF] pt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#263D3C]">
                    Journal lines
                  </h3>
                  <p className="mt-1 text-xs text-[#8A948B]">
                    Select accounts and enter the debit and credit amounts.
                  </p>
                </div>

                <Button type="button" variant="outline" onClick={addLine}>
                  Add line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-4 rounded-xl border border-[#E4E5DC] bg-[#F6F6F1] p-4 md:grid-cols-[2fr_1.2fr_1fr_1fr_auto]"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#78847C]">
                        Account
                      </label>
                      <Select
                        value={line.accountId}
                        onChange={(event) =>
                          updateLine(index, "accountId", event.target.value)
                        }
                        required
                      >
                        <option value="">Select account</option>
                        {activeAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#78847C]">
                        Description
                      </label>
                      <Input
                        value={line.description}
                        onChange={(event) =>
                          updateLine(index, "description", event.target.value)
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#78847C]">
                        Debit ({currency})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(event) =>
                          updateLine(index, "debit", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-[#78847C]">
                        Credit ({currency})
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(event) =>
                          updateLine(index, "credit", event.target.value)
                        }
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={lines.length <= 2}
                        onClick={() => removeLine(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Debit and credit totals */}
              <div className="mt-5 grid gap-3 rounded-xl border border-[#DDE3D8] bg-[#EFF1EA] p-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78847C]">
                    Total debit
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-[#263D3C]">
                    {formatMoney(totalDebit, currency)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78847C]">
                    Total credit
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-[#263D3C]">
                    {formatMoney(totalCredit, currency)}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#78847C]">
                    Difference
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-[#263D3C]">
                    {formatMoney(Math.abs(totalDebit - totalCredit), currency)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8E7DF] pt-5">
              <p className="text-xs text-[#8A948B]">
                Debits and credits must balance before saving.
              </p>

              <Button
                type="submit"
                disabled={
                  isPending ||
                  lines.length < 2 ||
                  totalDebit <= 0 ||
                  Math.abs(totalDebit - totalCredit) > 0.001
                }
              >
                {isPending ? "Saving..." : "Save as draft"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Tabs */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E1D8]">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("entries")}
              className={`relative pb-3 text-sm transition-colors ${
                activeTab === "entries"
                  ? "font-semibold text-[#263D3C] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#829987]"
                  : "text-[#849087] hover:text-[#263D3C]"
              }`}
            >
              Journal entries
              <span className="ml-2 rounded-md bg-[#EFF0E9] px-2 py-0.5 text-[10px] text-[#617C68]">
                {entryList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("accounts")}
              className={`relative pb-3 text-sm transition-colors ${
                activeTab === "accounts"
                  ? "font-semibold text-[#263D3C] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#829987]"
                  : "text-[#849087] hover:text-[#263D3C]"
              }`}
            >
              Chart of accounts
              <span className="ml-2 rounded-md bg-[#EFF0E9] px-2 py-0.5 text-[10px] text-[#617C68]">
                {accountList.length}
              </span>
            </button>
          </div>
        </div>

        {/* Journal entries */}
        {activeTab === "entries" && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#263D3C]">
                Journal entries
              </h2>
              <p className="mt-1 text-xs text-[#8A948B]">
                Review your recorded transactions and their debit and credit
                details.
              </p>
            </div>

            {entryList.length === 0 ? (
              <div className="rounded-xl border border-[#E2E1D8] bg-[#FBFAF7] p-10 text-center">
                <p className="text-sm font-medium text-[#52645A]">
                  No journal entries yet
                </p>
                <p className="mt-1 text-xs text-[#8A948B]">
                  Your recorded journal entries will appear here.
                </p>
              </div>
            ) : (
              entryList.map((entry) => (
                <div
                  key={entry.id}
                  className="overflow-hidden rounded-xl border border-[#E2E1D8] bg-[#FBFAF7]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#263D3C]">
                          {entry.entryNumber}
                        </p>
                        <Badge>{entry.status}</Badge>
                      </div>

                      <p className="mt-2 text-sm font-medium text-[#3C5148]">
                        {entry.description}
                      </p>

                      <p className="mt-2 text-xs text-[#849087]">
                        {formatDate(entry.entryDate)} · {entry.branchName}
                        {entry.reference ? ` · Ref: ${entry.reference}` : ""}
                      </p>
                    </div>

                    {canManage && entry.status === "DRAFT" && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handlePostEntry(entry.id)}
                      >
                        Post entry
                      </Button>
                    )}
                  </div>

                  <div className="overflow-x-auto border-t border-[#EAE9E2]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#F1F1EB] text-[10px] font-semibold uppercase tracking-wider text-[#78847C]">
                        <tr>
                          <th className="px-5 py-3">Account</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="px-5 py-3 text-right">Debit</th>
                          <th className="px-5 py-3 text-right">Credit</th>
                        </tr>
                      </thead>

                      <tbody>
                        {entry.lines.map((line) => (
                          <tr
                            key={line.id}
                            className="border-t border-[#ECEBE4] text-[#52645A]"
                          >
                            <td className="px-5 py-3 font-medium text-[#354A40]">
                              {line.accountCode} - {line.accountName}
                            </td>

                            <td className="px-5 py-3 text-xs text-[#849087]">
                              {line.description || "—"}
                            </td>

                            <td className="px-5 py-3 text-right tabular-nums">
                              {formatMoney(Number(line.debit), currency)}
                            </td>

                            <td className="px-5 py-3 text-right tabular-nums">
                              {formatMoney(Number(line.credit), currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* Chart of accounts */}
        {activeTab === "accounts" && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#263D3C]">
                Chart of accounts
              </h2>
              <p className="mt-1 text-xs text-[#8A948B]">
                Manage the accounts used to organise your business finances.
              </p>
            </div>

            {canManage && (
              <form
                onSubmit={handleCreateAccount}
                className="rounded-xl border border-[#E2E1D8] bg-[#FBFAF7] p-5 sm:p-6"
              >
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#829987]">
                    Account setup
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[#263D3C]">
                    Add ledger account
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-[#52645A]"
                      htmlFor="account-code"
                    >
                      Account code
                    </label>
                    <Input
                      id="account-code"
                      value={accountCode}
                      onChange={(event) => setAccountCode(event.target.value)}
                      placeholder="e.g. 6500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-[#52645A]"
                      htmlFor="account-name"
                    >
                      Account name
                    </label>
                    <Input
                      id="account-name"
                      value={accountName}
                      onChange={(event) => setAccountName(event.target.value)}
                      placeholder="e.g. Cleaning"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-[#52645A]"
                      htmlFor="account-type"
                    >
                      Account type
                    </label>
                    <Select
                      id="account-type"
                      value={accountType}
                      onChange={(event) => setAccountType(event.target.value)}
                    >
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-medium text-[#52645A]"
                      htmlFor="account-description"
                    >
                      Description (optional)
                    </label>
                    <Input
                      id="account-description"
                      value={accountDescription}
                      onChange={(event) =>
                        setAccountDescription(event.target.value)
                      }
                      placeholder="Account details"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Saving..." : "Create account"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Accounts table */}
            <div className="overflow-hidden rounded-xl border border-[#E2E1D8] bg-[#FBFAF7]">
              <div className="border-b border-[#E8E7DF] px-5 py-4">
                <h3 className="text-sm font-semibold text-[#263D3C]">
                  All ledger accounts
                </h3>
                <p className="mt-1 text-xs text-[#8A948B]">
                  {accountList.length} accounts registered
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F1F1EB] text-[10px] font-semibold uppercase tracking-wider text-[#78847C]">
                    <tr>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-5 py-3">Account name</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Category</th>
                    </tr>
                  </thead>

                  <tbody>
                    {accountList.map((account) => (
                      <tr
                        key={account.id}
                        className="border-t border-[#ECEBE4] text-[#52645A] transition-colors hover:bg-[#F7F7F2]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-[#354A40]">
                          {account.code}
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-[#354A40]">
                            {account.name}
                          </p>
                          {account.description && (
                            <p className="mt-1 text-xs text-[#8A948B]">
                              {account.description}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {TYPE_LABELS[account.type] ?? account.type}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-medium ${
                              account.isActive
                                ? "bg-[#E6EFE5] text-[#4C7455]"
                                : "bg-[#F0EEEA] text-[#8A8175]"
                            }`}
                          >
                            {account.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs text-[#849087]">
                          {account.isSystem ? "System" : "Custom"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
