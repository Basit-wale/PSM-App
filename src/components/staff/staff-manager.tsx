"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { createStaffInvitation } from "@/app/actions/staff-invitation";
import {
  updateStaffRole,
  setStaffStatus,
  revokeStaffInvitation,
  createBranchStaff,
  setBranchStaffStatus,
} from "@/app/actions/staff-management";

type Branch = {
  id: string;
  name: string;
  code: string;
};

type StaffRole =
  | "OWNER"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "ACCOUNTANT"
  | "INVENTORY_MANAGER"
  | "RECEPTIONIST"
  | "CRM_MANAGER";

type AssignableRole = Exclude<StaffRole, "OWNER">;

type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  branches: string[];
  branchIds: string[];
};

type BranchStaffMember = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  branchId: string;
  branchName: string;
};

type Invitation = {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: string;
  branches: string[];
};

type StaffManagerProps = {
  branches: Branch[];
  members: StaffMember[];
  invitations: Invitation[];
  branchStaff: BranchStaffMember[];
  currentMemberId: string;
  canManageStaff: boolean;
  canInviteAdmin: boolean;
};

const STAFF_ROLES: {
  value: AssignableRole;
  label: string;
}[] = [
  { value: "BRANCH_MANAGER", label: "Branch Manager" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "CRM_MANAGER", label: "CRM Manager" },
];

type Confirmation =
  | { type: "status"; member: StaffMember }
  | { type: "revoke"; invitation: Invitation }
  | null;

function formatRole(role: string) {
  return role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

const inputClass =
  "w-full rounded-xl border border-[#dce5dc] bg-white px-3.5 py-2.5 text-sm text-[#294638] outline-none transition placeholder:text-[#9aa99d] focus:border-[#78977e] focus:ring-2 focus:ring-[#78977e]/15";

const sectionClass =
  "overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white shadow-[0_2px_12px_rgba(39,65,48,0.035)]";

const tableHeaderClass =
  "bg-[#f5f7f2] text-[11px] font-semibold uppercase tracking-[0.09em] text-[#758477]";

const cellClass = "px-5 py-4";

export function StaffManager({
  branches,
  members,
  invitations,
  branchStaff,
  currentMemberId,
  canManageStaff,
  canInviteAdmin,
}: StaffManagerProps) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("BRANCH_MANAGER");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [branchStaffName, setBranchStaffName] = useState("");
  const [branchStaffPhone, setBranchStaffPhone] = useState("");
  const [branchStaffBranchId, setBranchStaffBranchId] = useState("");
  const [branchStaffError, setBranchStaffError] = useState("");
  const [branchStaffSuccess, setBranchStaffSuccess] = useState("");

  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState<AssignableRole>("BRANCH_MANAGER");
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);

  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [actionError, setActionError] = useState("");

  const [isPending, startTransition] = useTransition();

  const activeMembers = members.filter((member) => member.isActive).length;
  const inactiveMembers = members.length - activeMembers;

  function toggleBranch(
    id: string,
    selected: string[],
    setter: (value: string[]) => void,
  ) {
    setter(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInvitationUrl("");
    setCopied(false);

    startTransition(async () => {
      const result = await createStaffInvitation({
        email,
        role,
        branchIds: role === "ADMIN" ? [] : branchIds,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setInvitationUrl(result.invitationUrl);
      setEmail("");
      setBranchIds([]);
      router.refresh();
    });
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
    } catch {
      setError("Unable to copy the link. Please copy it manually.");
    }
  }

  function openEditor(member: StaffMember) {
    setActionError("");
    setEditingMember(member);
    setEditRole(member.role as AssignableRole);
    setEditBranchIds(member.branchIds);
  }

  function saveStaffChanges() {
    if (!editingMember) return;

    setActionError("");

    startTransition(async () => {
      const result = await updateStaffRole(
        editingMember.id,
        editRole,
        editRole === "ADMIN" ? [] : editBranchIds,
      );

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setEditingMember(null);
      router.refresh();
    });
  }

  function confirmAction() {
    if (!confirmation) return;

    setActionError("");

    startTransition(async () => {
      let result;

      if (confirmation.type === "status") {
        result = await setStaffStatus(
          confirmation.member.id,
          !confirmation.member.isActive,
        );
      } else {
        result = await revokeStaffInvitation(confirmation.invitation.id);
      }

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setConfirmation(null);
      router.refresh();
    });
  }

  function handleBranchStaffSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBranchStaffError("");
    setBranchStaffSuccess("");

    startTransition(async () => {
      const result = await createBranchStaff(
        branchStaffName.trim(),
        branchStaffPhone.trim(),
        branchStaffBranchId,
      );

      if (!result.success) {
        setBranchStaffError(result.error);
        return;
      }

      setBranchStaffName("");
      setBranchStaffPhone("");
      setBranchStaffBranchId("");
      setBranchStaffSuccess("Regular staff member added successfully.");
      router.refresh();
    });
  }

  function toggleBranchStaffStatus(person: BranchStaffMember) {
    setBranchStaffError("");
    setBranchStaffSuccess("");

    startTransition(async () => {
      const result = await setBranchStaffStatus(person.id, !person.isActive);

      if (!result.success) {
        setBranchStaffError(result.error);
        return;
      }

      setBranchStaffSuccess(
        `${person.name} has been ${person.isActive ? "deactivated" : "reactivated"}.`,
      );
      router.refresh();
    });
  }

  function canManageMember(member: StaffMember) {
    if (
      !canManageStaff ||
      member.role === "OWNER" ||
      member.id === currentMemberId
    ) {
      return false;
    }

    if (member.role === "ADMIN" && !canInviteAdmin) {
      return false;
    }

    return true;
  }

  return (
    <div className="staff-page min-h-full space-y-7 bg-[#f7f8f4] pb-8 text-[#294638]">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#82947f]">
            Organization
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#294638]">
            Staff & Permissions
          </h1>
          <p className="mt-1.5 text-sm text-[#819083]">
            Manage your team, access levels and branch assignments.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-[#e1e9df] bg-white px-3.5 py-2 text-xs font-medium text-[#627b65]">
          <span className="h-2 w-2 rounded-full bg-[#78977e]" />
          {members.length} team members
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9df] bg-white p-5 shadow-[0_2px_12px_rgba(39,65,48,0.035)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#829083]">Total staff</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf3eb] text-[#66836a]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                  strokeLinecap="round"
                />
                <circle cx="10" cy="7" r="4" />
                <path
                  d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#294638] tabular-nums">
            {members.length}
          </p>
          <p className="mt-1 text-xs text-[#95a094]">Registered members</p>
        </div>

        <div className="rounded-2xl border border-[#e2e9df] bg-white p-5 shadow-[0_2px_12px_rgba(39,65,48,0.035)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#829083]">Active staff</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf3eb] text-[#64836a]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="m5 12 4 4L19 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#294638] tabular-nums">
            {activeMembers}
          </p>
          <p className="mt-1 text-xs text-[#95a094]">
            With organization access
          </p>
        </div>

        <div className="rounded-2xl border border-[#e2e9df] bg-white p-5 shadow-[0_2px_12px_rgba(39,65,48,0.035)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#829083]">
              Pending invitations
            </p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f0e5] text-[#a18a58]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path
                  d="m3 7 9 6 9-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#294638] tabular-nums">
            {invitations.length}
          </p>
          <p className="mt-1 text-xs text-[#95a094]">Awaiting acceptance</p>
        </div>
      </div>

      {/* Invite staff */}
      {canManageStaff && (
        <section className={sectionClass}>
          <div className="flex items-start gap-3 border-b border-[#edf0e9] px-5 py-5 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3eb] text-[#66836a]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#294638]">
                Invite a team member
              </h2>
              <p className="mt-1 text-xs leading-5 text-[#8b998b]">
                Add a new member and configure their role and branch access.
                Invitations are valid for seven days.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Email address" htmlFor="staff-email">
                  <Input
                    id="staff-email"
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="staff@example.com"
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Staff role" htmlFor="staff-role">
                  <Select
                    id="staff-role"
                    value={role}
                    onChange={(event) => {
                      setRole(event.target.value as AssignableRole);
                      setBranchIds([]);
                    }}
                    className={inputClass}
                  >
                    {STAFF_ROLES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                    {canInviteAdmin && <option value="ADMIN">Admin</option>}
                  </Select>
                </FormField>
              </div>

              {role !== "ADMIN" && (
                <fieldset>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <legend className="text-sm font-semibold text-[#3d5947]">
                        Branch assignments
                      </legend>
                      <p className="mt-1 text-xs text-[#94a093]">
                        Choose which branches this staff member can access.
                      </p>
                    </div>
                    <span className="rounded-lg bg-[#f1f5ef] px-2.5 py-1 text-[11px] font-medium text-[#708771]">
                      {branchIds.length} selected
                    </span>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-[#e5ebe2] bg-[#fafbf8] p-3 sm:grid-cols-2">
                    {branches.length === 0 ? (
                      <p className="col-span-full py-2 text-sm text-[#89968a]">
                        No active branches available.
                      </p>
                    ) : (
                      branches.map((branch) => (
                        <label
                          key={branch.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-sm transition hover:border-[#dfe8dc] hover:bg-white"
                        >
                          <Checkbox
                            checked={branchIds.includes(branch.id)}
                            onChange={() =>
                              toggleBranch(branch.id, branchIds, setBranchIds)
                            }
                            className="h-4 w-4 accent-[#58785f]"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-[#405b48]">
                              {branch.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-[#99a397]">
                              {branch.code}
                            </span>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
              )}

              {role === "ADMIN" && (
                <div className="rounded-xl border border-[#e5ebe2] bg-[#f5f8f3] px-4 py-3">
                  <p className="text-xs leading-5 text-[#6e846f]">
                    Admin access applies to all branches.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={
                    isPending || (role !== "ADMIN" && branchIds.length === 0)
                  }
                >
                  {isPending ? "Creating invitation..." : "Create invitation"}
                </Button>
                <span className="text-xs text-[#9aa497]">
                  A secure invitation link will be generated.
                </span>
              </div>
            </form>

            {invitationUrl && (
              <div className="mt-6 rounded-xl border border-[#dce8d9] bg-[#f3f7f1] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e0ecdf] text-[#64816a]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-4 w-4"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="m5 12 4 4L19 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <h3 className="text-sm font-semibold text-[#385a40]">
                    Invitation created successfully
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#758875]">
                  Share this link with the invited staff member. It can only be
                  used once and expires after seven days.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={invitationUrl}
                    aria-label="Invitation link"
                    className="min-w-0 flex-1 rounded-xl border border-[#dce5d8] bg-white px-3 py-2.5 text-xs text-[#536b57]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyInvitation}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Regular branch staff - no login required */}
      <section>
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91a08e]">
            Service team
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#294638]">
            Regular Branch Staff
          </h2>
          <p className="mt-1 text-xs text-[#929d91]">
            Manage salon workers who do not need system login accounts. They can
            be assigned to services in POS.
          </p>
        </div>

        <div className={sectionClass}>
          {canManageStaff && (
            <div className="border-b border-[#edf0e9] p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-[#385442]">
                Add regular staff member
              </h3>
              <p className="mt-1 text-xs text-[#929d91]">
                Create a staff profile and assign it to a branch.
              </p>

              <form
                onSubmit={handleBranchStaffSubmit}
                className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <FormField label="Staff name" htmlFor="branch-staff-name">
                  <Input
                    id="branch-staff-name"
                    value={branchStaffName}
                    onChange={(event) => setBranchStaffName(event.target.value)}
                    placeholder="Enter full name"
                    required
                    minLength={2}
                    maxLength={100}
                    className={inputClass}
                  />
                </FormField>

                <FormField
                  label="Phone number (optional)"
                  htmlFor="branch-staff-phone"
                >
                  <Input
                    id="branch-staff-phone"
                    value={branchStaffPhone}
                    onChange={(event) =>
                      setBranchStaffPhone(event.target.value)
                    }
                    placeholder="Phone number"
                    maxLength={30}
                    className={inputClass}
                  />
                </FormField>

                <FormField label="Branch" htmlFor="branch-staff-branch">
                  <Select
                    id="branch-staff-branch"
                    value={branchStaffBranchId}
                    onChange={(event) =>
                      setBranchStaffBranchId(event.target.value)
                    }
                    className={inputClass}
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={isPending || branches.length === 0}
                    className="w-full"
                  >
                    {isPending ? "Adding..." : "Add staff member"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {(branchStaffError || branchStaffSuccess) && (
            <div className="px-5 pt-4 sm:px-6">
              {branchStaffError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {branchStaffError}
                </div>
              )}

              {branchStaffSuccess && (
                <div
                  role="status"
                  className="rounded-xl border border-[#dce8d9] bg-[#f3f7f1] px-4 py-3 text-sm text-[#547456]"
                >
                  {branchStaffSuccess}
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className={tableHeaderClass}>
                <tr>
                  <th className="px-5 py-4 font-semibold">Staff member</th>
                  <th className="px-5 py-4 font-semibold">Phone</th>
                  <th className="px-5 py-4 font-semibold">Branch</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  {canManageStaff && (
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#edf0e9]">
                {branchStaff.map((person) => (
                  <tr
                    key={person.id}
                    className="transition-colors hover:bg-[#fafbf8]"
                  >
                    <td className={cellClass}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2e9] text-xs font-semibold text-[#66806a]">
                          {person.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#385442]">
                            {person.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[#929d91]">
                            No login account
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className={`${cellClass} text-xs text-[#748375]`}>
                      {person.phone || "—"}
                    </td>

                    <td className={`${cellClass} text-xs text-[#748375]`}>
                      {person.branchName}
                    </td>

                    <td className={cellClass}>
                      <Badge>{person.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </td>

                    {canManageStaff && (
                      <td className={cellClass}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => toggleBranchStaffStatus(person)}
                        >
                          {person.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}

                {branchStaff.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManageStaff ? 5 : 4}
                      className="px-5 py-12 text-center"
                    >
                      <p className="text-sm font-medium text-[#526b57]">
                        No regular branch staff yet
                      </p>
                      <p className="mt-1 text-xs text-[#9aa497]">
                        Add staff members who work at your salon without needing
                        login accounts.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#edf0e9] bg-[#fafbf8] px-5 py-3">
            <p className="text-[11px] text-[#929d91]">
              {branchStaff.length} regular{" "}
              {branchStaff.length === 1 ? "staff member" : "staff members"}
            </p>
          </div>
        </div>
      </section>

      {/* Current staff */}
      <section>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91a08e]">
              Team directory
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#294638]">
              Current staff
            </h2>
            <p className="mt-1 text-xs text-[#929d91]">
              View team members, assigned roles and access status.
            </p>
          </div>
          <div className="flex gap-2 text-[11px]">
            <span className="rounded-lg bg-[#eaf2e9] px-2.5 py-1.5 font-medium text-[#65816a]">
              {activeMembers} active
            </span>
            <span className="rounded-lg bg-[#f2f1ed] px-2.5 py-1.5 font-medium text-[#8d9188]">
              {inactiveMembers} inactive
            </span>
          </div>
        </div>

        <div className={sectionClass}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className={tableHeaderClass}>
                <tr>
                  <th className="px-5 py-4 font-semibold">Staff member</th>
                  <th className="px-5 py-4 font-semibold">Role</th>
                  <th className="px-5 py-4 font-semibold">Branches</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  {canManageStaff && (
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0e9]">
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="transition-colors hover:bg-[#fafbf8]"
                  >
                    <td className={cellClass}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2e9] text-xs font-semibold text-[#66806a]">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#385442]">
                            {member.name}
                            {member.id === currentMemberId && (
                              <span className="ml-2 text-[10px] font-medium text-[#91a08e]">
                                YOU
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-[#929d91]">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cellClass}>
                      <span className="inline-flex rounded-lg bg-[#f1f4ee] px-2.5 py-1.5 text-xs font-medium text-[#637965]">
                        {formatRole(member.role)}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-[230px]`}>
                      <p className="text-xs leading-5 text-[#748375]">
                        {member.role === "ADMIN"
                          ? "All branches"
                          : member.branches.length > 0
                            ? member.branches.join(", ")
                            : "No branches assigned"}
                      </p>
                    </td>
                    <td className={cellClass}>
                      <Badge>{member.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                    </td>
                    {canManageStaff && (
                      <td className={cellClass}>
                        {canManageMember(member) ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditor(member)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActionError("");
                                setConfirmation({ type: "status", member });
                              }}
                            >
                              {member.isActive ? "Deactivate" : "Reactivate"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#a0a99e]">
                            Protected
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}

                {members.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManageStaff ? 5 : 4}
                      className="px-5 py-12 text-center"
                    >
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f4ee] text-[#91a08e]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path
                            d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                            strokeLinecap="round"
                          />
                          <circle cx="10" cy="7" r="4" />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[#526b57]">
                        No staff members found
                      </p>
                      <p className="mt-1 text-xs text-[#9aa497]">
                        Staff members will appear here once added.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#edf0e9] bg-[#fafbf8] px-5 py-3">
            <p className="text-[11px] text-[#929d91]">
              Showing {members.length} staff{" "}
              {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
      </section>

      {/* Pending invitations */}
      <section>
        <div className="mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91a08e]">
            Access requests
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#294638]">
            Pending invitations
          </h2>
          <p className="mt-1 text-xs text-[#929d91]">
            Invitations that have been created but not yet accepted.
          </p>
        </div>

        <div className={sectionClass}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className={tableHeaderClass}>
                <tr>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Role</th>
                  <th className="px-5 py-4 font-semibold">Branches</th>
                  <th className="px-5 py-4 font-semibold">Expires</th>
                  {canManageStaff && (
                    <th className="px-5 py-4 font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0e9]">
                {invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="transition-colors hover:bg-[#fafbf8]"
                  >
                    <td className="px-5 py-4 font-medium text-[#405b48]">
                      {invitation.email}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-lg bg-[#f1f4ee] px-2.5 py-1.5 text-xs font-medium text-[#637965]">
                        {formatRole(invitation.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[#748375]">
                      {invitation.branches.length > 0
                        ? invitation.branches.join(", ")
                        : "All branches"}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#849184]">
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </td>
                    {canManageStaff && (
                      <td className="px-5 py-4">
                        {invitation.role !== "ADMIN" || canInviteAdmin ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActionError("");
                              setConfirmation({ type: "revoke", invitation });
                            }}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-xs text-[#a0a99e]">
                            Protected
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}

                {invitations.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManageStaff ? 5 : 4}
                      className="px-5 py-12 text-center"
                    >
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f4ee] text-[#91a08e]">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-5 w-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path
                            d="m3 7 9 6 9-6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-medium text-[#526b57]">
                        No pending invitations
                      </p>
                      <p className="mt-1 text-xs text-[#9aa497]">
                        New invitations will appear here.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#edf0e9] bg-[#fafbf8] px-5 py-3">
            <p className="text-[11px] text-[#929d91]">
              {invitations.length} pending{" "}
              {invitations.length === 1 ? "invitation" : "invitations"}
            </p>
          </div>
        </div>
      </section>

      {/* Edit staff dialog */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d3025]/40 p-4 backdrop-blur-[3px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e3e9df] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b9b87]">
                  Team management
                </p>
                <h2
                  id="edit-staff-title"
                  className="mt-1 text-lg font-semibold text-[#294638]"
                >
                  Edit staff access
                </h2>
                <p className="mt-1 text-xs text-[#8b998b]">
                  {editingMember.name} · {editingMember.email}
                </p>
              </div>
              <span className="rounded-xl bg-[#edf3eb] px-3 py-2 text-[11px] font-medium text-[#68816b]">
                Edit member
              </span>
            </div>

            <div className="mt-6 space-y-5">
              <FormField label="Role" htmlFor="edit-staff-role">
                <Select
                  id="edit-staff-role"
                  value={editRole}
                  onChange={(event) => {
                    setEditRole(event.target.value as AssignableRole);
                    setEditBranchIds([]);
                  }}
                  className={inputClass}
                >
                  {STAFF_ROLES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                  {canInviteAdmin && <option value="ADMIN">Admin</option>}
                </Select>
              </FormField>

              {editRole !== "ADMIN" && (
                <fieldset>
                  <div className="mb-3 flex items-center justify-between">
                    <legend className="text-sm font-semibold text-[#405b48]">
                      Branch access
                    </legend>
                    <span className="rounded-lg bg-[#f1f5ef] px-2.5 py-1 text-[11px] text-[#708771]">
                      {editBranchIds.length} selected
                    </span>
                  </div>
                  <div className="grid gap-2 rounded-xl border border-[#e5ebe2] bg-[#fafbf8] p-3 sm:grid-cols-2">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-3 text-sm transition hover:bg-white"
                      >
                        <Checkbox
                          checked={editBranchIds.includes(branch.id)}
                          onChange={() =>
                            toggleBranch(
                              branch.id,
                              editBranchIds,
                              setEditBranchIds,
                            )
                          }
                          className="h-4 w-4 accent-[#58785f]"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-[#405b48]">
                            {branch.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-[#99a397]">
                            {branch.code}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {editRole === "ADMIN" && (
                <div className="rounded-xl border border-[#e5ebe2] bg-[#f5f8f3] px-4 py-3">
                  <p className="text-xs leading-5 text-[#6e846f]">
                    Admin access applies to all branches.
                  </p>
                </div>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {actionError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-[#edf0e9] pt-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    isPending ||
                    (editRole !== "ADMIN" && editBranchIds.length === 0)
                  }
                  onClick={saveStaffChanges}
                >
                  {isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d3025]/40 p-4 backdrop-blur-[3px]">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-confirm-title"
            className="w-full max-w-md rounded-2xl border border-[#e3e9df] bg-white p-6 shadow-2xl"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4f1e8] text-[#9b8657]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.7L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h2
              id="staff-confirm-title"
              className="mt-4 text-lg font-semibold text-[#294638]"
            >
              {confirmation.type === "status"
                ? confirmation.member.isActive
                  ? "Deactivate staff member?"
                  : "Reactivate staff member?"
                : "Revoke invitation?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#829083]">
              {confirmation.type === "status"
                ? confirmation.member.isActive
                  ? `${confirmation.member.name} will lose access to this organization until reactivated.`
                  : `${confirmation.member.name} will regain access to this organization.`
                : `The invitation sent to ${confirmation.invitation.email} will no longer be usable.`}
            </p>

            {actionError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-[#edf0e9] pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setConfirmation(null);
                  setActionError("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={confirmAction}
              >
                {isPending ? "Please wait..." : "Confirm"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
