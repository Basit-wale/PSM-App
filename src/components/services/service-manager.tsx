"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import {
  createService,
  updateService,
  setServiceStatus,
} from "@/app/actions/service";
import {
  createServiceCategory,
  updateServiceCategory,
  setServiceCategoryStatus,
} from "@/app/actions/service-category";

type ServiceRecord = {
  id: string;
  categoryId: string;
  category: {
    name: string;
  };
  name: string;
  description: string | null;
  price: string;
  durationMins: number | null;
  isActive: boolean;
};

type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type ServiceManagerProps = {
  services: ServiceRecord[];
  categories: CategoryRecord[];
  canManageServices: boolean;
};

type ServiceForm = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  durationMins: string;
};

const emptyForm: ServiceForm = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  durationMins: "",
};

const currencyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
});

const fieldClassName =
  "w-full rounded-lg border border-[#DDE2DA] bg-[#FBFAF7] px-3 py-2.5 text-sm text-[#354139] outline-none transition-colors placeholder:text-[#9A9F98] focus:border-[#819783] focus:ring-2 focus:ring-[#819783]/15";

const panelClassName =
  "overflow-hidden rounded-xl border border-[#E2E4DC] bg-[#FBFAF7]";

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#354139]">{title}</h2>
      <p className="mt-1 text-xs text-[#858C83]">{description}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E4DC] bg-[#FBFAF7] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-[#858C83]">{label}</p>
        <span className={`h-2 w-2 rounded-full ${accent}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-[#354139] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-[#92988F]">{description}</p>
    </div>
  );
}

export function ServiceManager({
  services,
  categories,
  canManageServices,
}: ServiceManagerProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRecord | null>(
    null,
  );
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmService, setConfirmService] = useState<ServiceRecord | null>(
    null,
  );

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [categoryError, setCategoryError] = useState("");
  const [confirmCategory, setConfirmCategory] = useState<CategoryRecord | null>(
    null,
  );

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return services;

    return services.filter((service) => {
      return (
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query)
      );
    });
  }, [services, search]);

  const activeCount = services.filter((service) => service.isActive).length;
  const inactiveCount = services.length - activeCount;

  function openCreateForm() {
    setEditingService(null);
    setForm({
      ...emptyForm,
      categoryId: categories.find((category) => category.isActive)?.id ?? "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(service: ServiceRecord) {
    setEditingService(service);
    setForm({
      categoryId: service.categoryId,
      name: service.name,
      description: service.description ?? "",
      price: service.price,
      durationMins: service.durationMins?.toString() ?? "",
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingService(null);
    setForm(emptyForm);
    setError("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = editingService
        ? await updateService({
            id: editingService.id,
            ...form,
          })
        : await createService(form);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(
        editingService
          ? "Service updated successfully."
          : "Service created successfully.",
      );

      closeForm();
      router.refresh();
    });
  }

  function handleStatusChange() {
    if (!confirmService) return;

    const service = confirmService;
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = await setServiceStatus({
        id: service.id,
        isActive: !service.isActive,
      });

      if (!result.success) {
        setError(result.error);
        setConfirmService(null);
        return;
      }

      setSuccess(
        service.isActive
          ? "Service deactivated successfully."
          : "Service activated successfully.",
      );

      setConfirmService(null);
      router.refresh();
    });
  }

  function openCategoryForm(category?: CategoryRecord) {
    setEditingCategory(category ?? null);
    setCategoryForm({
      name: category?.name ?? "",
      description: category?.description ?? "",
    });
    setCategoryError("");
    setShowCategoryForm(true);
  }

  function handleCategorySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryError("");

    startTransition(async () => {
      const result = editingCategory
        ? await updateServiceCategory({
            id: editingCategory.id,
            ...categoryForm,
          })
        : await createServiceCategory(categoryForm);

      if (!result.success) {
        setCategoryError(result.error);
        return;
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
      setSuccess(
        editingCategory
          ? "Category updated successfully."
          : "Category created successfully.",
      );
      router.refresh();
    });
  }

  function handleCategoryStatusChange() {
    if (!confirmCategory) return;

    const category = confirmCategory;

    startTransition(async () => {
      const result = await setServiceCategoryStatus({
        id: category.id,
        isActive: !category.isActive,
      });

      if (!result.success) {
        setError(result.error);
        setConfirmCategory(null);
        return;
      }

      setSuccess(
        category.isActive
          ? "Category deactivated successfully."
          : "Category activated successfully.",
      );
      setConfirmCategory(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-8">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-[#354139]">
              Services
            </h1>
            <Badge variant="muted">{services.length} total</Badge>
          </div>
          <p className="mt-1 text-sm text-[#858C83]">
            Manage your service menu, pricing and categories.
          </p>
        </div>

        {canManageServices && (
          <Button type="button" onClick={openCreateForm}>
            Add service
          </Button>
        )}
      </div>

      {/* Feedback messages */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-[#D6E2D5] bg-[#EDF3EB] px-4 py-3 text-sm text-[#526B55]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#718B73]" />
          {success}
        </div>
      )}

      {error && !showForm && (
        <div className="rounded-lg border border-[#E8D3D0] bg-[#F8EFED] px-4 py-3 text-sm text-[#A34F49]">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total services"
          value={services.length}
          description="Services in your directory"
          accent="bg-[#879887]"
        />
        <SummaryCard
          label="Active services"
          value={activeCount}
          description="Available for bookings"
          accent="bg-[#718B73]"
        />
        <SummaryCard
          label="Inactive services"
          value={inactiveCount}
          description="Currently unavailable"
          accent="bg-[#B4A58F]"
        />
      </div>

      {/* Service form */}
      {showForm && (
        <div className={panelClassName}>
          <div className="border-b border-[#E7E8E1] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#354139]">
              {editingService ? "Edit service" : "Add new service"}
            </h2>
            <p className="mt-1 text-xs text-[#858C83]">
              Services are shared across all branches.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            {error && (
              <div className="rounded-lg border border-[#E8D3D0] bg-[#F8EFED] px-4 py-3 text-sm text-[#A34F49]">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Service category"
                htmlFor="service-category"
                required
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Select
                  id="service-category"
                  required
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                  className={fieldClassName}
                >
                  <option value="">Select a category</option>
                  {categories
                    .filter((category) => category.isActive)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </Select>
              </FormField>

              <FormField
                label="Service name"
                htmlFor="service-name"
                required
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Input
                  id="service-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Haircut"
                  className={fieldClassName}
                />
              </FormField>

              <FormField
                label="Price (NGN)"
                htmlFor="service-price"
                required
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Input
                  id="service-price"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  placeholder="e.g. 5000"
                  className={fieldClassName}
                />
              </FormField>

              <FormField
                label="Duration (minutes)"
                htmlFor="service-duration"
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Input
                  id="service-duration"
                  type="number"
                  min="5"
                  max="1440"
                  step="1"
                  value={form.durationMins}
                  onChange={(event) =>
                    setForm({ ...form, durationMins: event.target.value })
                  }
                  placeholder="e.g. 60"
                  className={fieldClassName}
                />
                <p className="text-[11px] text-[#92988F]">
                  Optional. Between 5 and 1,440 minutes.
                </p>
              </FormField>

              <div className="sm:col-span-2">
                <FormField
                  label="Description"
                  htmlFor="service-description"
                  labelClassName="text-xs font-medium text-[#626D63]"
                >
                  <Textarea
                    id="service-description"
                    rows={3}
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Describe this service..."
                    className={`${fieldClassName} resize-y`}
                  />
                </FormField>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E7E8E1] pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editingService
                    ? "Save changes"
                    : "Create service"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Categories */}
      <div className={panelClassName}>
        <div className="flex flex-col justify-between gap-3 border-b border-[#E7E8E1] px-5 py-4 sm:flex-row sm:items-center">
          <SectionHeading
            title="Service categories"
            description="Organize your services into groups."
          />

          {canManageServices && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openCategoryForm()}
            >
              Add category
            </Button>
          )}
        </div>

        {showCategoryForm && (
          <form
            onSubmit={handleCategorySubmit}
            className="space-y-4 border-b border-[#E7E8E1] bg-[#F5F5F0] p-5"
          >
            <div>
              <h3 className="text-sm font-semibold text-[#354139]">
                {editingCategory ? "Edit category" : "New category"}
              </h3>
              <p className="mt-1 text-xs text-[#858C83]">
                Enter the category details below.
              </p>
            </div>

            {categoryError && (
              <div className="rounded-lg border border-[#E8D3D0] bg-[#F8EFED] px-3 py-2 text-sm text-[#A34F49]">
                {categoryError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Category name"
                htmlFor="category-name"
                required
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Input
                  id="category-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      name: event.target.value,
                    })
                  }
                  placeholder="e.g. Haircut"
                  className={fieldClassName}
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="category-description"
                labelClassName="text-xs font-medium text-[#626D63]"
              >
                <Input
                  id="category-description"
                  maxLength={1000}
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      description: event.target.value,
                    })
                  }
                  placeholder="Optional description"
                  className={fieldClassName}
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setShowCategoryForm(false);
                  setEditingCategory(null);
                  setCategoryError("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Saving..." : "Save category"}
              </Button>
            </div>
          </form>
        )}

        {categories.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-[#626D63]">
              No categories yet
            </p>
            <p className="mt-1 text-xs text-[#92988F]">
              Create a category to start organizing your services.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EAEAE4]">
            {categories.map((category) => {
              const serviceCount = services.filter(
                (service) => service.categoryId === category.id,
              ).length;

              return (
                <div
                  key={category.id}
                  className="flex flex-col justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#F7F7F2] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[#354139]">
                        {category.name}
                      </p>
                      <Badge variant={category.isActive ? "default" : "muted"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#92988F]">
                      {serviceCount}{" "}
                      {serviceCount === 1 ? "service" : "services"}
                    </p>
                    {category.description && (
                      <p className="mt-1 text-xs text-[#858C83]">
                        {category.description}
                      </p>
                    )}
                  </div>

                  {canManageServices && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openCategoryForm(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCategoryError("");
                          setConfirmCategory(category);
                        }}
                      >
                        {category.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Service directory */}
      <div className={panelClassName}>
        <div className="flex flex-col justify-between gap-3 border-b border-[#E7E8E1] px-5 py-4 sm:flex-row sm:items-center">
          <SectionHeading
            title="Service directory"
            description={`${filteredServices.length} service${filteredServices.length === 1 ? "" : "s"} displayed`}
          />

          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services..."
            className="w-full rounded-lg border border-[#DDE2DA] bg-[#F7F7F2] px-3 py-2 text-sm text-[#354139] outline-none placeholder:text-[#9A9F98] focus:border-[#819783] focus:ring-2 focus:ring-[#819783]/15 sm:max-w-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-[#F2F3ED] text-[10px] font-medium uppercase tracking-[0.08em] text-[#858C83]">
              <tr>
                <th className="px-5 py-3 font-semibold">Service</th>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Price</th>
                <th className="px-5 py-3 font-semibold">Duration</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                {canManageServices && (
                  <th className="px-5 py-3 text-right font-semibold">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#EAEAE4]">
              {filteredServices.map((service) => (
                <tr
                  key={service.id}
                  className="transition-colors hover:bg-[#F6F7F2]"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[#354139]">{service.name}</p>
                    {service.description && (
                      <p className="mt-1 max-w-sm text-xs leading-5 text-[#92988F]">
                        {service.description}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-[#69746A]">
                    {service.category.name}
                  </td>

                  <td className="px-5 py-3.5 text-xs font-medium tabular-nums text-[#465449]">
                    {currencyFormatter.format(Number(service.price))}
                  </td>

                  <td className="px-5 py-3.5 text-xs text-[#69746A]">
                    {service.durationMins ? `${service.durationMins} min` : "—"}
                  </td>

                  <td className="px-5 py-3.5">
                    <Badge variant={service.isActive ? "default" : "muted"}>
                      {service.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>

                  {canManageServices && (
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditForm(service)}
                        >
                          Edit
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => setConfirmService(service)}
                        >
                          {service.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {filteredServices.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageServices ? 6 : 5}
                    className="px-5 py-12 text-center"
                  >
                    <p className="text-sm font-medium text-[#626D63]">
                      {search ? "No matching services" : "No services yet"}
                    </p>
                    <p className="mt-1 text-xs text-[#92988F]">
                      {search
                        ? "Try another search term."
                        : "Services you create will appear here."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category confirmation */}
      {confirmCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202820]/45 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setConfirmCategory(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-confirm-title"
            className="w-full max-w-md rounded-xl border border-[#E2E4DC] bg-[#FBFAF7] p-6 shadow-2xl"
          >
            <h2
              id="category-confirm-title"
              className="text-base font-semibold text-[#354139]"
            >
              {confirmCategory.isActive
                ? "Deactivate category?"
                : "Activate category?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#737D73]">
              {confirmCategory.isActive
                ? `Are you sure you want to deactivate "${confirmCategory.name}"? Active services must first be deactivated or moved to another category.`
                : `Are you sure you want to activate "${confirmCategory.name}"?`}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirmCategory(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isPending}
                onClick={handleCategoryStatusChange}
              >
                {isPending ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Service confirmation */}
      {confirmService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#202820]/45 p-4 backdrop-blur-[2px]"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              setConfirmService(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-confirm-title"
            className="w-full max-w-md rounded-xl border border-[#E2E4DC] bg-[#FBFAF7] p-6 shadow-2xl"
          >
            <h2
              id="service-confirm-title"
              className="text-base font-semibold text-[#354139]"
            >
              {confirmService.isActive
                ? "Deactivate service?"
                : "Activate service?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#737D73]">
              {confirmService.isActive
                ? `“${confirmService.name}” will no longer be available for new bookings or sales. Existing records will remain unchanged.`
                : `“${confirmService.name}” will become available for new bookings and sales again.`}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setConfirmService(null)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isPending}
                onClick={handleStatusChange}
              >
                {isPending ? "Please wait..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
