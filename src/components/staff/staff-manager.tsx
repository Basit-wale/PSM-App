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

export function StaffManager({
  branches,
  members,
  invitations,
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

  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editRole, setEditRole] = useState<AssignableRole>("BRANCH_MANAGER");
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);

  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [actionError, setActionError] = useState("");

  const [isPending, startTransition] = useTransition();

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
    <div className="staff-page space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Staff</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage staff accounts, roles and branch assignments.
        </p>
      </div>

      {canManageStaff && (
        <section className="border border-zinc-200 bg-white p-5">
          <h2 className="text-base font-semibold text-zinc-900">
            Invite staff member
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Invitations are valid for seven days.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 max-w-2xl space-y-5">
            <FormField label="Email address" htmlFor="staff-email">
              <Input
                id="staff-email"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@example.com"
                className="w-full border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
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
                className="w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
              >
                {STAFF_ROLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
                {canInviteAdmin && <option value="ADMIN">Admin</option>}
              </Select>
            </FormField>

            {role !== "ADMIN" && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-zinc-700">
                  Assign branches
                </legend>
                <p className="mb-3 text-xs text-zinc-500">
                  Select the branches this staff member can access.
                </p>

                <div className="space-y-2 border border-zinc-200 p-3">
                  {branches.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No active branches available.
                    </p>
                  ) : (
                    branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center gap-3 text-sm text-zinc-700"
                      >
                        <Checkbox
                          checked={branchIds.includes(branch.id)}
                          onChange={() =>
                            toggleBranch(branch.id, branchIds, setBranchIds)
                          }
                          className="h-4 w-4 accent-zinc-900"
                        />
                        <span>
                          {branch.name}
                          <span className="ml-2 text-xs text-zinc-400">
                            {branch.code}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </fieldset>
            )}

            {error && (
              <div
                role="alert"
                className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isPending || (role !== "ADMIN" && branchIds.length === 0)
              }
            >
              {isPending ? "Creating invitation..." : "Create invitation"}
            </Button>
          </form>

          {invitationUrl && (
            <div className="mt-6 border border-zinc-300 bg-zinc-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900">
                Invitation created
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                Share this link with the invited staff member. It can only be
                used once and expires after seven days.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  value={invitationUrl}
                  aria-label="Invitation link"
                  className="min-w-0 flex-1 border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700"
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
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Current staff
          </h2>
          <span className="text-xs text-zinc-500">
            {members.length} members
          </span>
        </div>

        <div className="overflow-x-auto border border-zinc-200 bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Staff member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Branches</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManageStaff && (
                  <th className="px-4 py-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{member.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {member.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatRole(member.role)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {member.role === "ADMIN"
                      ? "All branches"
                      : member.branches.length > 0
                        ? member.branches.join(", ")
                        : "No branches assigned"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{member.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                  </td>
                  {canManageStaff && (
                    <td className="px-4 py-3">
                      {canManageMember(member) ? (
                        <div className="flex items-center gap-3">
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
                        <span className="text-xs text-zinc-400">Protected</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageStaff ? 5 : 4}
                    className="px-4 py-8 text-center text-sm text-zinc-500"
                  >
                    No staff members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Pending invitations
          </h2>
          <span className="text-xs text-zinc-500">
            {invitations.length} pending
          </span>
        </div>

        <div className="overflow-x-auto border border-zinc-200 bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Branches</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                {canManageStaff && (
                  <th className="px-4 py-3 font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {invitation.email}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatRole(invitation.role)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {invitation.branches.length > 0
                      ? invitation.branches.join(", ")
                      : "All branches"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </td>
                  {canManageStaff && (
                    <td className="px-4 py-3">
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
                        <span className="text-xs text-zinc-400">Protected</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}

              {invitations.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageStaff ? 5 : 4}
                    className="px-4 py-8 text-center text-sm text-zinc-500"
                  >
                    No pending invitations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-zinc-300 bg-white p-6"
          >
            <h2
              id="edit-staff-title"
              className="text-lg font-semibold text-zinc-900"
            >
              Edit staff access
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {editingMember.name} · {editingMember.email}
            </p>

            <div className="mt-5 space-y-5">
              <FormField label="Role" htmlFor="edit-staff-role">
                <Select
                  id="edit-staff-role"
                  value={editRole}
                  onChange={(event) => {
                    setEditRole(event.target.value as AssignableRole);
                    setEditBranchIds([]);
                  }}
                  className="w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
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
                  <legend className="mb-2 text-sm font-medium text-zinc-700">
                    Branch access
                  </legend>
                  <div className="space-y-2 border border-zinc-200 p-3">
                    {branches.map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center gap-3 text-sm text-zinc-700"
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
                          className="h-4 w-4 accent-zinc-900"
                        />
                        <span>
                          {branch.name}{" "}
                          <span className="text-xs text-zinc-400">
                            {branch.code}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {actionError && (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {actionError}
                </div>
              )}

              <div className="flex justify-end gap-3">
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

      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-confirm-title"
            className="w-full max-w-md border border-zinc-300 bg-white p-6"
          >
            <h2
              id="staff-confirm-title"
              className="text-lg font-semibold text-zinc-900"
            >
              {confirmation.type === "status"
                ? confirmation.member.isActive
                  ? "Deactivate staff member?"
                  : "Reactivate staff member?"
                : "Revoke invitation?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {confirmation.type === "status"
                ? confirmation.member.isActive
                  ? `${confirmation.member.name} will lose access to this organization until reactivated.`
                  : `${confirmation.member.name} will regain access to this organization.`
                : `The invitation sent to ${confirmation.invitation.email} will no longer be usable.`}
            </p>

            {actionError && (
              <div
                role="alert"
                className="mt-4 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {actionError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
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
