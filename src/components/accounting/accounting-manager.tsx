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

  return (
    <div className="accounting-page space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your chart of accounts and journal entries.
        </p>
      </div>

      {message && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-neutral-500">Ledger accounts</p>
          <p className="mt-2 text-2xl font-semibold">{accountList.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-neutral-500">Journal entries</p>
          <p className="mt-2 text-2xl font-semibold">{entryList.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-neutral-500">Draft entries</p>
          <p className="mt-2 text-2xl font-semibold">
            {entryList.filter((entry) => entry.status === "DRAFT").length}
          </p>
        </div>
      </div>

      {canManage && (
        <section className="rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Create journal entry</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Record a balanced transaction using debit and credit lines.
          </p>

          <form onSubmit={handleCreateEntry} className="mt-5 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
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
                  className="text-sm font-medium"
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
                <label className="text-sm font-medium" htmlFor="entry-date">
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
                <label className="text-sm font-medium" htmlFor="entry-branch">
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

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">Journal lines</h3>
                <Button type="button" variant="outline" onClick={addLine}>
                  Add line
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border p-3 md:grid-cols-[2fr_1.2fr_1fr_1fr_auto]"
                  >
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
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

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
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

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
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

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-neutral-500">
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

              <div className="mt-4 grid gap-2 rounded-md bg-neutral-50 p-4 text-sm sm:grid-cols-2">
                <p>
                  Total debit:{" "}
                  <strong>{formatMoney(totalDebit, currency)}</strong>
                </p>
                <p>
                  Total credit:{" "}
                  <strong>{formatMoney(totalCredit, currency)}</strong>
                </p>
                <p className="sm:col-span-2">
                  Difference:{" "}
                  <strong>
                    {formatMoney(Math.abs(totalDebit - totalCredit), currency)}
                  </strong>
                </p>
              </div>
            </div>

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
          </form>
        </section>
      )}

      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("entries")}
          className={`border-b-2 px-4 py-2 text-sm ${
            activeTab === "entries"
              ? "border-black font-semibold"
              : "border-transparent text-neutral-500"
          }`}
        >
          Journal entries
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`border-b-2 px-4 py-2 text-sm ${
            activeTab === "accounts"
              ? "border-black font-semibold"
              : "border-transparent text-neutral-500"
          }`}
        >
          Chart of accounts
        </button>
      </div>

      {activeTab === "entries" && (
        <section className="space-y-3">
          {entryList.length === 0 ? (
            <div className="rounded-lg border p-8 text-center text-sm text-neutral-500">
              No journal entries yet.
            </div>
          ) : (
            entryList.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{entry.entryNumber}</p>
                    <p className="mt-1 text-sm">{entry.description}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(entry.entryDate)} · {entry.branchName}
                      {entry.reference ? ` · Ref: ${entry.reference}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge>{entry.status}</Badge>

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
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b text-xs text-neutral-500">
                      <tr>
                        <th className="py-2 pr-3">Account</th>
                        <th className="py-2 pr-3">Description</th>
                        <th className="py-2 pr-3 text-right">Debit</th>
                        <th className="py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            {line.accountCode} - {line.accountName}
                          </td>
                          <td className="py-2 pr-3 text-neutral-500">
                            {line.description || "—"}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {formatMoney(Number(line.debit), currency)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
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

      {activeTab === "accounts" && (
        <section className="space-y-5">
          {canManage && (
            <form
              onSubmit={handleCreateAccount}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"
            >
              <h2 className="font-semibold md:col-span-2">
                Add ledger account
              </h2>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="account-code">
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
                <label className="text-sm font-medium" htmlFor="account-name">
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
                <label className="text-sm font-medium" htmlFor="account-type">
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
                  className="text-sm font-medium"
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
            </form>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {accountList.map((account) => (
                  <tr key={account.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{account.code}</td>
                    <td className="px-4 py-3">
                      <div>{account.name}</div>
                      {account.description && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {account.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {TYPE_LABELS[account.type] ?? account.type}
                    </td>
                    <td className="px-4 py-3">
                      {account.isActive ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-3">
                      {account.isSystem ? "System" : "Custom"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
