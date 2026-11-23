"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getSmsAudienceCount,
  sendSmsCampaign,
  getSmsCampaignHistory,
} from "@/app/actions/sms";
import { createCustomer, updateCustomer } from "@/app/actions/customer";

type BranchOption = {
  id: string;
  name: string;
  code: string;
};

type CustomerRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  dateOfBirth: Date | null;
  notes: string | null;
  status: string;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  createdAt: Date;
  branches: {
    branchId: string;
    branch: {
      name: string;
      code: string;
    };
  }[];
};

type CustomerManagerProps = {
  customers: CustomerRecord[];
  branches: BranchOption[];
  canManageCustomers: boolean;
  organizationWide: boolean;
  canManageSms: boolean;
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  notes: string;
};

type SmsCampaignRecord = {
  id: string;
  message: string;
  senderId: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: Date;
  branch: { name: string } | null;
};

const emptyForm: CustomerForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  whatsappOptIn: false,
  smsOptIn: false,
  notes: "",
};

const panelClass =
  "rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(35,45,35,0.025)]";

const fieldClass =
  "h-10 w-full rounded-lg border border-[#DDE1D8] bg-[#FEFDFC] px-3 text-sm text-[#39443C] outline-none transition-colors placeholder:text-[#9A9F98] focus:border-[#879B89] focus:ring-2 focus:ring-[#879B89]/15";

function PreferenceLabel({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium ${
        enabled ? "bg-[#E8EEE7] text-[#526B57]" : "bg-[#F0F0EC] text-[#858A82]"
      }`}
    >
      {enabled ? "Opted in" : "Not opted in"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className={`${panelClass} px-4 py-4`}>
      <p className="text-xs font-medium text-[#777F76]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#354139] tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] text-[#92978F]">{detail}</p>
    </div>
  );
}

export function CustomerManager({
  customers,
  branches,
  canManageCustomers,
  canManageSms,
  organizationWide,
}: CustomerManagerProps) {
  const router = useRouter();

  const [showMergeConfirmation, setShowMergeConfirmation] = useState(false);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(
    null,
  );
  const [selectedBranchId, setSelectedBranchId] = useState(
    branches[0]?.id ?? "",
  );
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info",
  );

  const [pendingMerge, setPendingMerge] = useState<{
    customer: CustomerForm;
    branchId: string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  // SMS broadcast state
  const [smsBranchId, setSmsBranchId] = useState(
    organizationWide ? "ALL" : (branches[0]?.id ?? ""),
  );
  const [smsMessage, setSmsMessage] = useState("");
  const [smsRecipientCount, setSmsRecipientCount] = useState<number | null>(
    null,
  );
  const [smsNotice, setSmsNotice] = useState("");
  const [smsNoticeError, setSmsNoticeError] = useState(false);
  const [smsPending, startSmsTransition] = useTransition();
  const [smsCampaigns, setSmsCampaigns] = useState<SmsCampaignRecord[]>([]);
  const [smsHistoryLoading, setSmsHistoryLoading] = useState(false);

  // Load SMS audience and campaign history
  useEffect(() => {
    if (!canManageSms) return;

    let cancelled = false;

    async function loadSmsData() {
      setSmsHistoryLoading(true);

      try {
        const [countResult, historyResult] = await Promise.all([
          getSmsAudienceCount({
            branchId: smsBranchId === "ALL" ? null : smsBranchId,
          }),
          getSmsCampaignHistory(),
        ]);

        if (cancelled) return;

        setSmsRecipientCount(
          countResult.success ? countResult.recipientCount : null,
        );

        if (historyResult.success) {
          setSmsCampaigns(historyResult.campaigns);
        }
      } catch {
        if (!cancelled) {
          setSmsRecipientCount(null);
        }
      } finally {
        if (!cancelled) {
          setSmsHistoryLoading(false);
        }
      }
    }

    loadSmsData();

    return () => {
      cancelled = true;
    };
  }, [canManageSms, smsBranchId]);

  function handleSendSms() {
    if (!smsMessage.trim()) {
      setSmsNoticeError(true);
      setSmsNotice("Enter a message before sending.");
      return;
    }

    if (!smsRecipientCount) {
      setSmsNoticeError(true);
      setSmsNotice("There are no eligible recipients.");
      return;
    }

    const confirmed = window.confirm(
      `Send this SMS to ${smsRecipientCount} opted-in customers?`,
    );

    if (!confirmed) return;

    startSmsTransition(async () => {
      setSmsNotice("");

      try {
        const result = await sendSmsCampaign({
          branchId: smsBranchId === "ALL" ? null : smsBranchId,
          message: smsMessage.trim(),
        });

        if (!result.success) {
          setSmsNoticeError(true);
          setSmsNotice(result.error);
          return;
        }

        setSmsMessage("");
        setSmsNoticeError(false);
        setSmsNotice(
          `Campaign submitted successfully to ${result.recipientCount} recipients. ${
            result.sandbox
              ? "Sandbox test: no real SMS was sent."
              : "Messages submitted to the SMS provider."
          }`,
        );

        const history = await getSmsCampaignHistory();

        if (history.success) {
          setSmsCampaigns(history.campaigns);
        }

        router.refresh();
      } catch {
        setSmsNoticeError(true);
        setSmsNotice("Unable to submit the SMS campaign. Please try again.");
      }
    });
  }

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        `${customer.firstName} ${customer.lastName ?? ""}`
          .toLowerCase()
          .includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        (customer.email ?? "").toLowerCase().includes(query);

      const matchesBranch =
        branchFilter === "ALL" ||
        customer.branches.some((item) => item.branchId === branchFilter);

      return matchesSearch && matchesBranch;
    });
  }, [customers, search, branchFilter]);

  const whatsappCount = visibleCustomers.filter(
    (customer) => customer.whatsappOptIn,
  ).length;

  const smsCount = visibleCustomers.filter(
    (customer) => customer.smsOptIn && customer.status === "ACTIVE",
  ).length;

  function openCreateForm() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setSelectedBranchId(branches[0]?.id ?? "");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(customer: CustomerRecord) {
    setEditingCustomer(customer);
    setSelectedBranchId(
      customer.branches[0]?.branchId ?? branches[0]?.id ?? "",
    );
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName ?? "",
      phone: customer.phone,
      email: customer.email ?? "",
      dateOfBirth: customer.dateOfBirth
        ? new Date(customer.dateOfBirth).toISOString().slice(0, 10)
        : "",
      whatsappOptIn: customer.whatsappOptIn,
      smsOptIn: customer.smsOptIn,
      notes: customer.notes ?? "",
    });
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (isPending) return;
    setShowForm(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!selectedBranchId) {
      setMessageType("error");
      setMessage("Select a branch before continuing.");
      return;
    }

    startTransition(async () => {
      const result = editingCustomer
        ? await updateCustomer({
            customerId: editingCustomer.id,
            branchId: selectedBranchId,
            customer: form,
          })
        : await createCustomer({
            branchId: selectedBranchId,
            customer: form,
          });

      if (!result.success) {
        setMessageType("error");
        setMessage(result.error);
        return;
      }

      if (result.requiresConfirmation) {
        setPendingMerge({
          customer: { ...form },
          branchId: selectedBranchId,
        });

        setShowForm(false);
        setShowMergeConfirmation(true);
        return;
      }

      setMessageType("success");
      setMessage(
        editingCustomer
          ? "Customer details updated."
          : "Customer added successfully.",
      );

      setShowForm(false);
      setEditingCustomer(null);
      setForm(emptyForm);
      router.refresh();
    });
  }

  function confirmCustomerMerge() {
    if (
      !pendingMerge ||
      !pendingMerge.customer.firstName.trim() ||
      !pendingMerge.customer.phone.trim()
    ) {
      setShowMergeConfirmation(false);
      setShowForm(true);
      setMessageType("error");
      setMessage("Customer details are missing. Please try again.");
      return;
    }

    const customerData = {
      ...pendingMerge.customer,
    };

    const branchId = pendingMerge.branchId;

    startTransition(async () => {
      const result = await createCustomer({
        branchId,
        customer: customerData,
        confirmExisting: true,
      });

      if (!result.success) {
        setShowMergeConfirmation(false);
        setShowForm(true);
        setPendingMerge(null);
        setMessageType("error");
        setMessage(result.error);
        return;
      }

      setShowMergeConfirmation(false);
      setPendingMerge(null);
      setShowForm(false);
      setEditingCustomer(null);
      setForm(emptyForm);

      setMessageType("success");
      setMessage(
        "Existing customer profile updated and selected branch linked successfully.",
      );

      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#899287]">
            Customer relationship management
          </p>
          <h1 className="mt-1.5 text-[25px] font-semibold tracking-tight text-[#354139]">
            Customers
          </h1>
          <p className="mt-1 text-[13px] text-[#81877F]">
            Manage customer profiles, contact details and branch relationships.
          </p>
        </div>

        {canManageCustomers && (
          <Button type="button" onClick={openCreateForm} className="rounded-lg">
            Add customer
          </Button>
        )}
      </div>

      {message && !showForm && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            messageType === "error"
              ? "border-[#E8C7C3] bg-[#FAEFED] text-[#984F49]"
              : messageType === "success"
                ? "border-[#D5E2D4] bg-[#EDF3EC] text-[#526D56]"
                : "border-[#E3E5DD] bg-[#F4F4EF] text-[#626B62]"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Customers"
          value={visibleCustomers.length}
          detail="Matching current filters"
        />
        <SummaryCard
          label="WhatsApp consent"
          value={whatsappCount}
          detail="Customers opted in"
        />
        <SummaryCard
          label="SMS consent"
          value={smsCount}
          detail="Active customers opted in"
        />
      </div>

      {canManageSms && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#E8E9E2] px-4 py-4">
            <h2 className="text-sm font-semibold text-[#414B42]">
              SMS broadcasts
            </h2>
            <p className="mt-1 text-xs text-[#92978F]">
              Send messages to active customers who have opted in to receive
              SMS.
            </p>
          </div>

          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Recipient branch"
                htmlFor="sms-recipient-branch"
                labelClassName="text-xs font-medium text-[#596359]"
              >
                <Select
                  value={smsBranchId}
                  id="sms-recipient-branch"
                  onChange={(event) => {
                    setSmsBranchId(event.target.value);
                    setSmsNotice("");
                  }}
                  className={fieldClass}
                  disabled={smsPending}
                >
                  {organizationWide && (
                    <option value="ALL">All branches</option>
                  )}
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="rounded-lg border border-[#E3E5DD] bg-[#F5F6F1] px-4 py-3">
                <p className="text-xs font-medium text-[#777F76]">
                  Eligible recipients
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#354139]">
                  {smsHistoryLoading && smsRecipientCount === null
                    ? "..."
                    : (smsRecipientCount ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-[#92978F]">
                  Active customers with SMS consent and valid phone numbers
                </p>
              </div>
            </div>

            <FormField
              label="Message"
              htmlFor="sms-broadcast-message"
              labelClassName="text-xs font-medium text-[#596359]"
            >
              <Textarea
                value={smsMessage}
                id="sms-broadcast-message"
                onChange={(event) => setSmsMessage(event.target.value)}
                rows={4}
                maxLength={1530}
                placeholder="Write your SMS broadcast..."
                className="w-full resize-y rounded-lg border border-[#DDE1D8] bg-[#FEFDFC] px-3 py-2 text-sm text-[#39443C] outline-none placeholder:text-[#9A9F98] focus:border-[#879B89] focus:ring-2 focus:ring-[#879B89]/15"
                disabled={smsPending}
              />
            </FormField>

            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-[11px] text-[#92978F]">
                {smsMessage.length.toLocaleString()} / 1,530 characters
              </p>

              <Button
                type="button"
                onClick={handleSendSms}
                disabled={
                  smsPending ||
                  !smsMessage.trim() ||
                  !smsRecipientCount ||
                  !smsBranchId
                }
              >
                {smsPending ? "Submitting campaign..." : "Send SMS broadcast"}
              </Button>
            </div>

            {smsNotice && (
              <div
                role="status"
                className={`rounded-lg border px-3 py-2 text-sm ${
                  smsNoticeError
                    ? "border-[#E8C7C3] bg-[#FAEFED] text-[#984F49]"
                    : "border-[#D5E2D4] bg-[#EDF3EC] text-[#526D56]"
                }`}
              >
                {smsNotice}
              </div>
            )}
          </div>

          <div className="border-t border-[#E8E9E2]">
            <div className="px-4 py-3">
              <h3 className="text-xs font-semibold text-[#414B42]">
                Recent SMS campaigns
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-[#E8E9E2] bg-[#F4F4EF]">
                    {[
                      "Message",
                      "Branch",
                      "Recipients",
                      "Sent",
                      "Failed",
                      "Status",
                      "Date",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#ECEDE7]">
                  {smsCampaigns.map((campaign) => (
                    <tr key={campaign.id}>
                      <td className="max-w-[240px] px-4 py-3">
                        <p className="truncate text-xs text-[#465247]">
                          {campaign.message}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#687467]">
                        {campaign.branch?.name ?? "All branches"}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#59635A]">
                        {campaign.recipientCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#59635A]">
                        {campaign.sentCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#59635A]">
                        {campaign.failedCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-[#E8EEE7] px-2 py-1 text-[10px] font-medium text-[#526B57]">
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#858C83]">
                        {new Date(campaign.createdAt).toLocaleDateString(
                          "en-NG",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </td>
                    </tr>
                  ))}

                  {!smsHistoryLoading && smsCampaigns.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-xs text-[#92978F]"
                      >
                        No SMS campaigns yet.
                      </td>
                    </tr>
                  )}

                  {smsHistoryLoading && smsCampaigns.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-xs text-[#92978F]"
                      >
                        Loading campaign history...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#E8E9E2] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#414B42]">
              Customer register
            </h2>
            <p className="mt-0.5 text-xs text-[#92978F]">
              Search and manage your customer records
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="sm:w-[270px]">
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, phone or email..."
                className={fieldClass}
              />
            </div>

            <div className="sm:w-[190px]">
              <Select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className={fieldClass}
              >
                <option value="ALL">
                  {organizationWide ? "All branches" : "All assigned branches"}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-[#858C83]">
            Showing{" "}
            <span className="font-semibold text-[#4E5B50]">
              {visibleCustomers.length}
            </span>{" "}
            of {customers.length} customers
          </p>

          {(search || branchFilter !== "ALL") && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearch("");
                setBranchFilter("ALL");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[790px] border-collapse text-left">
            <thead>
              <tr className="border-y border-[#E8E9E2] bg-[#F4F4EF]">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                  Customer
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                  Phone
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                  Branches
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                  WhatsApp
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                  SMS
                </th>
                {canManageCustomers && (
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.09em] text-[#7D857B]">
                    Action
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#ECEDE7]">
              {visibleCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="transition-colors hover:bg-[#F6F6F1]"
                >
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-[#3E4940]">
                      {customer.firstName} {customer.lastName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#92978F]">
                      {customer.email || "No email provided"}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-[12px] tabular-nums text-[#59635A]">
                    {customer.phone}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {customer.branches.map((item) => (
                        <span
                          key={item.branchId}
                          className="rounded-md border border-[#E1E5DD] bg-[#F5F6F1] px-2 py-1 text-[10px] font-medium text-[#687467]"
                        >
                          {item.branch.name}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <PreferenceLabel enabled={customer.whatsappOptIn} />
                  </td>

                  <td className="px-4 py-3">
                    <PreferenceLabel enabled={customer.smsOptIn} />
                  </td>

                  {canManageCustomers && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditForm(customer)}
                      >
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}

              {visibleCustomers.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageCustomers ? 6 : 5}
                    className="px-4 py-14 text-center"
                  >
                    <p className="text-sm font-medium text-[#505B51]">
                      No customers found
                    </p>
                    <p className="mt-1 text-xs text-[#92978F]">
                      Try another search or select a different branch.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#E8E9E2] px-4 py-3">
          <p className="text-[11px] text-[#92978F]">
            Customer information is shared across linked branches.
          </p>
        </div>
      </section>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#202820]/45 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <div className="my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#E0E3DB] bg-[#FBFAF7] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E7E8E1] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#39453B]">
                  {editingCustomer ? "Edit customer" : "Add customer"}
                </h2>
                <p className="mt-1 text-xs text-[#858C82]">
                  Customer details are shared across linked branches.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeForm}
                disabled={isPending}
                aria-label="Close form"
              >
                ×
              </Button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[calc(100dvh-12rem)] space-y-5 overflow-y-auto p-5">
                {message && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#E8C7C3] bg-[#FAEFED] px-3 py-2 text-sm text-[#984F49]"
                  >
                    {message}
                  </div>
                )}

                <FormField
                  label="Branch"
                  htmlFor="customer-branch"
                  labelClassName="text-xs font-medium text-[#596359]"
                >
                  <Select
                    id="customer-branch"
                    value={selectedBranchId}
                    onChange={(event) =>
                      setSelectedBranchId(event.target.value)
                    }
                    required
                    disabled={isPending || branches.length === 0}
                    className={fieldClass}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </Select>

                  {editingCustomer && (
                    <p className="mt-1.5 text-[11px] text-[#8B9189]">
                      Editing updates the shared customer profile, not just this
                      branch.
                    </p>
                  )}
                </FormField>

                <div>
                  <p className="mb-3 text-xs font-semibold text-[#596359]">
                    Personal information
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      label="First name"
                      htmlFor="customer-first-name"
                      required
                      labelClassName="text-xs font-medium text-[#596359]"
                    >
                      <Input
                        id="customer-first-name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={form.firstName}
                        onChange={(event) =>
                          setForm({ ...form, firstName: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </FormField>

                    <FormField
                      label="Last name"
                      htmlFor="customer-last-name"
                      labelClassName="text-xs font-medium text-[#596359]"
                    >
                      <Input
                        id="customer-last-name"
                        maxLength={80}
                        value={form.lastName}
                        onChange={(event) =>
                          setForm({ ...form, lastName: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </FormField>

                    <FormField
                      label="Phone number"
                      htmlFor="customer-phone"
                      required
                      labelClassName="text-xs font-medium text-[#596359]"
                    >
                      <Input
                        id="customer-phone"
                        required
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          setForm({ ...form, phone: event.target.value })
                        }
                        placeholder="+234..."
                        className={fieldClass}
                      />
                    </FormField>

                    <FormField
                      label="Email address"
                      htmlFor="customer-email"
                      labelClassName="text-xs font-medium text-[#596359]"
                    >
                      <Input
                        id="customer-email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          setForm({ ...form, email: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </FormField>

                    <FormField
                      label="Date of birth"
                      htmlFor="customer-date-of-birth"
                      labelClassName="text-xs font-medium text-[#596359]"
                    >
                      <Input
                        id="customer-date-of-birth"
                        type="date"
                        value={form.dateOfBirth}
                        onChange={(event) =>
                          setForm({ ...form, dateOfBirth: event.target.value })
                        }
                        className={fieldClass}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="border-t border-[#E7E8E1] pt-4">
                  <p className="mb-1 text-xs font-semibold text-[#596359]">
                    Communication preferences
                  </p>
                  <p className="mb-3 text-[11px] text-[#92978F]">
                    Record the channels this customer has consented to receive
                    messages through.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-lg border border-[#E4E7DF] bg-[#F6F6F1] p-3 text-sm">
                      <Checkbox
                        checked={form.whatsappOptIn}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            whatsappOptIn: event.target.checked,
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-[13px] font-medium text-[#465247]">
                          WhatsApp
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-[#8A9188]">
                          Customer has consented to WhatsApp messages.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-[#E4E7DF] bg-[#F6F6F1] p-3 text-sm">
                      <Checkbox
                        checked={form.smsOptIn}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            smsOptIn: event.target.checked,
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-[13px] font-medium text-[#465247]">
                          SMS
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-5 text-[#8A9188]">
                          Customer has consented to SMS messages.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <FormField
                  label="Internal notes"
                  htmlFor="customer-notes"
                  labelClassName="text-xs font-medium text-[#596359]"
                >
                  <Textarea
                    id="customer-notes"
                    rows={3}
                    maxLength={2000}
                    value={form.notes}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                    placeholder="Optional customer notes..."
                    className="w-full resize-y rounded-lg border border-[#DDE1D8] bg-[#FEFDFC] px-3 py-2 text-sm text-[#39443C] outline-none placeholder:text-[#9A9F98] focus:border-[#879B89] focus:ring-2 focus:ring-[#879B89]/15"
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#E7E8E1] bg-[#F7F6F1] px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForm}
                  disabled={isPending}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isPending || branches.length === 0}
                >
                  {isPending
                    ? "Saving..."
                    : editingCustomer
                      ? "Save changes"
                      : "Add customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMergeConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#202820]/45 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="merge-title"
            aria-describedby="merge-description"
            className="w-full max-w-md rounded-xl border border-[#E0E3DB] bg-[#FBFAF7] p-6 shadow-2xl"
          >
            <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-[#F0EDE2] text-[#82764E]">
              <span className="text-lg font-semibold">!</span>
            </div>

            <h2
              id="merge-title"
              className="text-base font-semibold text-[#39453B]"
            >
              Existing customer found
            </h2>

            <p
              id="merge-description"
              className="mt-2 text-sm leading-6 text-[#737C72]"
            >
              A customer with this phone number already exists. Confirming will
              replace their existing profile details with the information you
              entered and link the selected branch.
            </p>

            <div className="mt-4 rounded-lg border border-[#E5E7DF] bg-[#F5F5F0] p-3">
              <p className="text-[11px] font-medium text-[#92978F]">
                Phone number
              </p>
              <p className="mt-1 text-sm font-medium text-[#465247]">
                {pendingMerge?.customer.phone}
              </p>

              <p className="mt-3 text-[11px] font-medium text-[#92978F]">
                Selected branch
              </p>
              <p className="mt-1 text-sm font-medium text-[#465247]">
                {
                  branches.find(
                    (branch) => branch.id === pendingMerge?.branchId,
                  )?.name
                }
              </p>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#8A9188]">
              Existing sales, appointments and other branch assignments will
              remain attached to the same customer record.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setShowMergeConfirmation(false);
                  setPendingMerge(null);
                  setShowForm(true);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isPending}
                onClick={confirmCustomerMerge}
              >
                {isPending ? "Merging..." : "Confirm merge"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
