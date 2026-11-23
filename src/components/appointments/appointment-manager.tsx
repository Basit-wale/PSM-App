"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAppointment,
  updateAppointmentStatus,
} from "@/app/actions/appointment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Branch = {
  id: string;
  name: string;
  code: string;
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  branches: { branchId: string }[];
};

type Service = {
  id: string;
  name: string;
  price: string;
  durationMins: number | null;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  branchIds: string[];
};

type AppointmentItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  durationMins: number | null;
};

type Appointment = {
  id: string;
  branchId: string;
  customerId: string;
  assignedMemberId: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  branch: { name: string };
  items: AppointmentItem[];
  staffName: string | null;
  customerName: string;
  customerPhone: string;
};

type Props = {
  branches: Branch[];
  customers: Customer[];
  services: Service[];
  staff: Staff[];
  appointments: Appointment[];
  canManageAppointments: boolean;
};

const statuses = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SummaryCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: number | string;
  description: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium tracking-wide text-[#747C73]">
          {label}
        </p>
        <span className={`h-2 w-2 rounded-full ${accent}`} />
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#354238]">
        {value.toLocaleString()}
      </p>
      <p className="mt-2 text-[11px] text-[#899087]">{description}</p>
    </div>
  );
}

export function AppointmentManager({
  branches,
  customers,
  services,
  staff,
  appointments,
  canManageAppointments,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [startsAt, setStartsAt] = useState(localDateTimeValue());
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const availableCustomers = useMemo(
    () =>
      customers.filter((customer) =>
        customer.branches.some((branch) => branch.branchId === branchId),
      ),
    [customers, branchId],
  );

  const availableStaff = useMemo(
    () => staff.filter((member) => member.branchIds.includes(branchId)),
    [staff, branchId],
  );

  const selectedServices = services.filter((service) =>
    serviceIds.includes(service.id),
  );

  const totalPrice = selectedServices.reduce(
    (total, service) => total + Number(service.price),
    0,
  );

  const totalDuration = selectedServices.reduce(
    (total, service) => total + (service.durationMins ?? 0),
    0,
  );

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesBranch =
      branchFilter === "ALL" || appointment.branchId === branchFilter;

    const matchesStatus =
      statusFilter === "ALL" || appointment.status === statusFilter;

    const searchText = search.trim().toLowerCase();
    const matchesSearch =
      !searchText ||
      appointment.customerName.toLowerCase().includes(searchText) ||
      appointment.customerPhone.toLowerCase().includes(searchText) ||
      appointment.items.some((item) =>
        item.serviceName.toLowerCase().includes(searchText),
      );

    return matchesBranch && matchesStatus && matchesSearch;
  });

  function resetForm() {
    setBranchId(branches[0]?.id ?? "");
    setCustomerId("");
    setAssignedMemberId("");
    setStartsAt(localDateTimeValue());
    setServiceIds([]);
    setNotes("");
    setError("");
  }

  function toggleService(id: string, checked: boolean) {
    setServiceIds((current) =>
      checked
        ? [...current, id]
        : current.filter((serviceId) => serviceId !== id),
    );
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await createAppointment({
        branchId,
        customerId,
        assignedMemberId,
        startsAt: new Date(startsAt).toISOString(),
        serviceIds,
        notes,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setDialogOpen(false);
      resetForm();
      router.refresh();
    });
  }

  function handleStatusChange(appointmentId: string, status: string) {
    startTransition(async () => {
      const result = await updateAppointmentStatus({
        appointmentId,
        status,
      });

      if (!result.success) {
        window.alert(result.error);
        return;
      }

      router.refresh();
    });
  }

  const upcomingCount = appointments.filter((item) =>
    ["PENDING", "CONFIRMED"].includes(item.status),
  ).length;

  const completedCount = appointments.filter(
    (item) => item.status === "COMPLETED",
  ).length;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#829083]">
            Scheduling
          </p>
          <h1 className="mt-1 text-[25px] font-semibold tracking-tight text-[#354238]">
            Appointments
          </h1>
          <p className="mt-1 text-[13px] text-[#7D857C]">
            Manage bookings, schedules and appointment status.
          </p>
        </div>

        {canManageAppointments && (
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            disabled={branches.length === 0 || services.length === 0}
          >
            + Create appointment
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="TOTAL APPOINTMENTS"
          value={appointments.length}
          description="All recorded appointments"
          accent="bg-[#8A9B88]"
        />
        <SummaryCard
          label="UPCOMING / PENDING"
          value={upcomingCount}
          description="Pending and confirmed bookings"
          accent="bg-[#C39B61]"
        />
        <SummaryCard
          label="COMPLETED"
          value={completedCount}
          description="Successfully completed bookings"
          accent="bg-[#718A76]"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7]">
        <div className="border-b border-[#E9E9E2] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[#455147]">
            Appointment register
          </h2>
          <p className="mt-0.5 text-[11px] text-[#899087]">
            Search and filter your appointment records.
          </p>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1.5fr)_1fr_1fr]">
          <Input
            aria-label="Search appointments"
            placeholder="Search customer, phone or service..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <Select
            aria-label="Filter by branch"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option value="ALL">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center justify-between border-t border-[#E9E9E2] px-4 py-2.5">
          <p className="text-[11px] text-[#858D83]">
            Showing{" "}
            <span className="font-semibold text-[#4B574D]">
              {filteredAppointments.length}
            </span>{" "}
            of {appointments.length} appointments
          </p>
          {(search || branchFilter !== "ALL" || statusFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setBranchFilter("ALL");
                setStatusFilter("ALL");
              }}
              className="text-[11px] font-medium text-[#617968] transition hover:text-[#435C49]"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead className="border-y border-[#E8E9E2] bg-[#F3F3ED] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#788076]">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date &amp; time</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Services</th>
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Status</th>
                {canManageAppointments && (
                  <th className="px-4 py-3">Update status</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EEEEEA]">
              {filteredAppointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="align-middle transition-colors hover:bg-[#F6F6F1]"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-[#3F4B41]">
                      {appointment.customerName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#899087]">
                      {appointment.customerPhone}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3.5 text-[#59645A]">
                    {formatDate(appointment.startsAt)}
                  </td>

                  <td className="px-4 py-3.5 text-[#59645A]">
                    {appointment.branch.name}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      {appointment.items.map((item) => (
                        <p key={item.id} className="text-[#59645A]">
                          {item.serviceName}
                        </p>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-[#59645A]">
                    {appointment.staffName ?? (
                      <span className="text-[#9A9F96]">Unassigned</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <Badge>{appointment.status.replaceAll("_", " ")}</Badge>
                  </td>

                  {canManageAppointments && (
                    <td className="px-4 py-3.5">
                      <Select
                        aria-label={`Update status for ${appointment.customerName}`}
                        value={appointment.status}
                        disabled={isPending}
                        onChange={(event) =>
                          handleStatusChange(appointment.id, event.target.value)
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </td>
                  )}
                </tr>
              ))}

              {filteredAppointments.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageAppointments ? 7 : 6}
                    className="px-4 py-16 text-center"
                  >
                    <p className="text-[13px] font-medium text-[#59645A]">
                      No appointments found
                    </p>
                    <p className="mt-1 text-[11px] text-[#92988F]">
                      Try adjusting your search or filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Create appointment"
        size="2xl"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#829083]">
              Booking details
            </p>
            <p className="mt-1 text-[12px] text-[#899087]">
              Choose a branch, customer, staff member and appointment time.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Branch" htmlFor="appointment-branch" required>
              <Select
                id="appointment-branch"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setCustomerId("");
                  setAssignedMemberId("");
                }}
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Customer" htmlFor="appointment-customer" required>
              <Select
                id="appointment-customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
              >
                <option value="">Select customer</option>
                {availableCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName ?? ""} —{" "}
                    {customer.phone}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Staff member" htmlFor="appointment-staff">
              <Select
                id="appointment-staff"
                value={assignedMemberId}
                onChange={(event) => setAssignedMemberId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {availableStaff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Appointment date and time"
              htmlFor="appointment-start"
              required
            >
              <Input
                id="appointment-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </FormField>
          </div>

          <div className="space-y-3">
            <div className="border-b border-[#E9E9E2] pb-3">
              <p className="text-[13px] font-semibold text-[#455147]">
                Select services *
              </p>
              <p className="mt-1 text-[11px] text-[#899087]">
                Select one or more services for this appointment.
              </p>
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[#E3E5DD] bg-[#F8F8F4] p-2">
              {services.map((service) => (
                <label
                  key={service.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 transition hover:bg-white"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      checked={serviceIds.includes(service.id)}
                      onChange={(event) =>
                        toggleService(service.id, event.target.checked)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-[#455147]">
                        {service.name}
                      </span>
                      <span className="text-[11px] text-[#899087]">
                        {service.durationMins ?? "Duration not set"}{" "}
                        {service.durationMins !== null ? "minutes" : ""}
                      </span>
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[12px] font-medium text-[#455147]">
                    {formatAmount(Number(service.price))}
                  </span>
                </label>
              ))}
            </div>

            {serviceIds.length === 0 && (
              <p className="text-[11px] text-[#899087]">
                Choose at least one service.
              </p>
            )}

            <div className="flex flex-wrap justify-between gap-3 rounded-lg border border-[#E3E5DD] bg-[#F3F4EE] px-4 py-3">
              <span className="text-[11px] text-[#697368]">
                Estimated duration:{" "}
                <span className="font-semibold text-[#455147]">
                  {totalDuration} minutes
                </span>
              </span>
              <span className="text-[12px] font-semibold text-[#455147]">
                Total: {formatAmount(totalPrice)}
              </span>
            </div>
          </div>

          <FormField label="Notes" htmlFor="appointment-notes">
            <Textarea
              id="appointment-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Additional appointment details..."
              rows={3}
            />
          </FormField>

          {error && (
            <p className="rounded-lg border border-[#E8C9C5] bg-[#FBF1EF] p-3 text-[12px] text-[#A34F49]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[#E9E9E2] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !branchId ||
                !customerId ||
                !startsAt ||
                serviceIds.length === 0
              }
            >
              {isPending ? "Saving..." : "Create appointment"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
