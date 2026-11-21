"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import {
  createBranch,
  updateBranch,
  setBranchStatus,
} from "@/app/actions/branch";

type BranchRecord = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type BranchManagerProps = {
  branches: BranchRecord[];
  canManageBranches: boolean;
};

type BranchForm = {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
};

const emptyForm: BranchForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
};

const inputClass =
  "h-10 w-full rounded-lg border border-[#DDE2DA] bg-[#FBFAF7] px-3 text-sm text-[#39443B] shadow-none outline-none transition-colors placeholder:text-[#A0A79F] focus:border-[#829783] focus:ring-2 focus:ring-[#829783]/15";

const textareaClass =
  "w-full rounded-lg border border-[#DDE2DA] bg-[#FBFAF7] px-3 py-2.5 text-sm text-[#39443B] shadow-none outline-none transition-colors placeholder:text-[#A0A79F] focus:border-[#829783] focus:ring-2 focus:ring-[#829783]/15";

const panelClass =
  "overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(35,45,35,0.03)]";

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] px-5 py-4 shadow-[0_1px_2px_rgba(35,45,35,0.03)]">
      <p className="text-xs font-medium tracking-wide text-[#7C857B]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#354137]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#8B938A]">{description}</p>
    </div>
  );
}

export function BranchManager({
  branches,
  canManageBranches,
}: BranchManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [error, setError] = useState("");
  const [confirmBranch, setConfirmBranch] = useState<BranchRecord | null>(null);

  const activeCount = branches.filter(
    (branch) => branch.status === "ACTIVE",
  ).length;

  const inactiveCount = branches.length - activeCount;

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEditForm(branch: BranchRecord) {
    setEditingId(branch.id);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      email: branch.email ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function updateField(field: keyof BranchForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = editingId
        ? await updateBranch({ id: editingId, ...form })
        : await createBranch(form);

      if (!result.success) {
        setError(result.error);
        return;
      }

      closeForm();
      router.refresh();
    });
  }

  function handleStatusChange(branch: BranchRecord) {
    setError("");
    setConfirmBranch(branch);
  }

  function confirmStatusChange() {
    if (!confirmBranch) return;

    const branch = confirmBranch;
    const nextStatus = branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    startTransition(async () => {
      const result = await setBranchStatus({
        id: branch.id,
        status: nextStatus,
      });

      if (!result.success) {
        setError(result.error);
        setConfirmBranch(null);
        return;
      }

      setConfirmBranch(null);
      router.refresh();
    });
  }

  return (
    <main className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#354137]">
            Branches
          </h1>
          <p className="mt-1 text-sm text-[#7C857B]">
            Manage your salon locations and branch information.
          </p>
        </div>

        {canManageBranches && (
          <Button
            type="button"
            onClick={openCreateForm}
            disabled={isPending}
            className="h-9 rounded-lg bg-[#617968] px-4 text-xs font-medium text-white shadow-sm hover:bg-[#526957]"
          >
            Add branch
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="TOTAL BRANCHES"
          value={branches.length}
          description="Registered locations"
        />
        <SummaryCard
          label="ACTIVE BRANCHES"
          value={activeCount}
          description="Available for operations"
        />
        <SummaryCard
          label="INACTIVE BRANCHES"
          value={inactiveCount}
          description="Currently deactivated"
        />
      </div>

      {/* Branch form */}
      {showForm && (
        <section className={panelClass}>
          <div className="border-b border-[#E8E9E2] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#3D493F]">
              {editingId ? "Edit branch" : "Add new branch"}
            </h2>
            <p className="mt-1 text-xs text-[#858E84]">
              Enter the location and contact information for this branch.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
              <FormField
                label="Branch name"
                htmlFor="branch-name"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="branch-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="e.g. Ikeja Branch"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Branch code"
                htmlFor="branch-code"
                required
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="branch-code"
                  required
                  minLength={2}
                  maxLength={20}
                  pattern="[A-Za-z0-9-]+"
                  value={form.code}
                  onChange={(event) =>
                    updateField("code", event.target.value.toUpperCase())
                  }
                  placeholder="e.g. IKEJA"
                  className={`${inputClass} uppercase`}
                />
              </FormField>

              <FormField
                label="Phone number"
                htmlFor="branch-phone"
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="branch-phone"
                  maxLength={30}
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="Branch phone number"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Email address"
                htmlFor="branch-email"
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Input
                  id="branch-email"
                  type="email"
                  maxLength={254}
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="branch@example.com"
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Branch address"
                htmlFor="branch-address"
                className="md:col-span-2"
                labelClassName="text-xs font-medium text-[#59645A]"
              >
                <Textarea
                  id="branch-address"
                  maxLength={255}
                  rows={3}
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Enter the complete branch address"
                  className={textareaClass}
                />
              </FormField>
            </div>

            {error && (
              <p className="rounded-lg border border-[#E8C9C5] bg-[#FBF0EE] px-3 py-2.5 text-xs text-[#A34F49]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-[#E8E9E2] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={isPending}
                className="h-9 rounded-lg border-[#DDE2DA] bg-[#FBFAF7] px-4 text-xs text-[#59645A] hover:bg-[#F0F2ED]"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isPending}
                className="h-9 rounded-lg bg-[#617968] px-5 text-xs text-white hover:bg-[#526957]"
              >
                {isPending
                  ? "Saving..."
                  : editingId
                    ? "Save changes"
                    : "Create branch"}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* General error */}
      {error && !showForm && (
        <p className="rounded-lg border border-[#E8C9C5] bg-[#FBF0EE] px-3 py-2.5 text-xs text-[#A34F49]">
          {error}
        </p>
      )}

      {/* Branch directory */}
      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E9E2] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#3D493F]">
              Branch directory
            </h2>
            <p className="mt-1 text-xs text-[#858E84]">
              All locations registered under your organization.
            </p>
          </div>

          <span className="rounded-md bg-[#EDF1EB] px-2.5 py-1 text-[11px] font-medium text-[#617968]">
            {branches.length} {branches.length === 1 ? "branch" : "branches"}
          </span>
        </div>

        {branches.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-[#465247]">
              No branches found
            </p>
            <p className="mt-1 text-xs text-[#8B938A]">
              Add your first branch to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-[#E8E9E2] bg-[#F4F4EE]">
                <tr>
                  <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Code
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Address
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                    Status
                  </th>
                  {canManageBranches && (
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-[#7C857B]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#ECEDE7]">
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="transition-colors hover:bg-[#F5F6F1]"
                  >
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-[#39443B]">
                        {branch.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#929A91]">
                        Salon location
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-[#F0F1EB] px-2 py-1 font-mono text-[11px] text-[#657267]">
                        {branch.code}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {branch.phone && (
                          <p className="text-xs text-[#59645A]">
                            {branch.phone}
                          </p>
                        )}
                        {branch.email && (
                          <p className="text-xs text-[#858E84]">
                            {branch.email}
                          </p>
                        )}
                        {!branch.phone && !branch.email && (
                          <span className="text-xs text-[#A0A79F]">—</span>
                        )}
                      </div>
                    </td>

                    <td className="max-w-[220px] px-4 py-3.5">
                      <p className="truncate text-xs text-[#687268]">
                        {branch.address || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge>{branch.status}</Badge>
                    </td>

                    {canManageBranches && (
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => openEditForm(branch)}
                            className="h-8 rounded-lg border-[#DDE2DA] bg-[#FBFAF7] px-3 text-[11px] text-[#59645A] hover:bg-[#F0F2ED]"
                          >
                            Edit
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleStatusChange(branch)}
                            className="h-8 rounded-lg border-[#DDE2DA] bg-[#FBFAF7] px-3 text-[11px] text-[#59645A] hover:bg-[#F0F2ED]"
                          >
                            {branch.status === "ACTIVE"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Status confirmation */}
      {confirmBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202820]/40 p-4 backdrop-blur-[2px]"
          onClick={() => {
            if (!isPending) setConfirmBranch(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-confirm-title"
            className="w-full max-w-md overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[#E8E9E2] px-5 py-4">
              <h2
                id="branch-confirm-title"
                className="text-sm font-semibold text-[#39443B]"
              >
                {confirmBranch.status === "ACTIVE"
                  ? "Deactivate branch"
                  : "Activate branch"}
              </h2>
            </div>

            <div className="space-y-2 px-5 py-5">
              <p className="text-sm text-[#59645A]">
                Are you sure you want to{" "}
                {confirmBranch.status === "ACTIVE" ? "deactivate" : "activate"}{" "}
                <strong className="font-semibold text-[#39443B]">
                  {confirmBranch.name}
                </strong>
                ?
              </p>

              <p className="text-xs leading-relaxed text-[#858E84]">
                {confirmBranch.status === "ACTIVE"
                  ? "This branch will no longer be available for normal operations."
                  : "This branch will become available for normal operations again."}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E8E9E2] px-5 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirmBranch(null)}
                className="h-9 rounded-lg border-[#DDE2DA] bg-[#FBFAF7] px-4 text-xs text-[#59645A] hover:bg-[#F0F2ED]"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isPending}
                onClick={confirmStatusChange}
                className="h-9 rounded-lg bg-[#617968] px-4 text-xs text-white hover:bg-[#526957]"
              >
                {isPending
                  ? "Processing..."
                  : confirmBranch.status === "ACTIVE"
                    ? "Deactivate branch"
                    : "Activate branch"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
