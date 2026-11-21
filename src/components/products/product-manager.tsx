"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import {
  createProduct,
  updateProduct,
  setProductStatus,
} from "@/app/actions/product";

type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  costPrice: string;
  sellingPrice: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
};

type ProductManagerProps = {
  products: ProductRecord[];
  canManageProducts: boolean;
};

type ProductForm = {
  name: string;
  sku: string;
  description: string;
  costPrice: string;
  sellingPrice: string;
};

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  description: "",
  costPrice: "",
  sellingPrice: "",
};

const panelClass =
  "overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(40,50,40,0.03)]";

const fieldClass =
  "w-full rounded-lg border border-[#D9DED5] bg-[#FDFCF9] px-3 py-2.5 text-[13px] text-[#39443B] outline-none transition placeholder:text-[#A0A69D] focus:border-[#879B89] focus:ring-2 focus:ring-[#879B89]/15";

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
    <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] px-4 py-4 shadow-[0_1px_2px_rgba(40,50,40,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#858D83]">
        {label}
      </p>
      <p className="mt-2 text-[25px] font-semibold leading-none tracking-tight text-[#354238] tabular-nums">
        {value.toLocaleString("en-NG")}
      </p>
      <p className="mt-2 text-xs text-[#92988F]">{detail}</p>
    </div>
  );
}

export function ProductManager({
  products,
  canManageProducts,
}: ProductManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(
    null,
  );

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmProduct, setConfirmProduct] = useState<ProductRecord | null>(
    null,
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" || product.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const activeCount = products.filter(
    (product) => product.status === "ACTIVE",
  ).length;

  const inactiveCount = products.length - activeCount;

  function openCreateForm() {
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(product: ProductRecord) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      sku: product.sku,
      description: product.description ?? "",
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (isPending) return;
    setShowForm(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setError("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    startTransition(async () => {
      const result = editingProduct
        ? await updateProduct({
            id: editingProduct.id,
            ...form,
          })
        : await createProduct(form);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setShowForm(false);
      setEditingProduct(null);
      setForm(emptyForm);
      setSuccess(
        editingProduct
          ? "Product updated successfully."
          : "Product created successfully.",
      );
      router.refresh();
    });
  }

  function handleStatusChange() {
    if (!confirmProduct) return;

    const product = confirmProduct;
    const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    startTransition(async () => {
      const result = await setProductStatus({
        id: product.id,
        status: newStatus,
      });

      if (!result.success) {
        setError(result.error);
        setConfirmProduct(null);
        return;
      }

      setSuccess(
        newStatus === "ACTIVE"
          ? "Product activated successfully."
          : "Product deactivated successfully.",
      );
      setConfirmProduct(null);
      router.refresh();
    });
  }

  const formatMoney = (value: string) =>
    `₦${Number(value).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const hasFilters = search.trim() !== "" || statusFilter !== "ALL";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#354238]">
            Products
          </h1>
          <p className="mt-1 text-[13px] text-[#858D83]">
            Manage your salon products, stock catalogue and pricing.
          </p>
        </div>

        {canManageProducts && (
          <Button type="button" onClick={openCreateForm}>
            Add product
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total products"
          value={products.length}
          detail="All registered products"
        />
        <SummaryCard
          label="Active products"
          value={activeCount}
          detail="Available in your catalogue"
        />
        <SummaryCard
          label="Inactive products"
          value={inactiveCount}
          detail="Currently deactivated"
        />
      </div>

      {error && !showForm && (
        <div className="rounded-lg border border-[#E6C9C3] bg-[#FBF1EF] px-4 py-3 text-[13px] text-[#98564F]">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-[#D6E2D4] bg-[#F0F5EF] px-4 py-3 text-[13px] text-[#58735B]">
          {success}
        </div>
      )}

      <section className={panelClass}>
        <div className="flex flex-col gap-3 border-b border-[#E8E9E2] px-4 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#414C42]">
              Product register
            </h2>
            <p className="mt-0.5 text-xs text-[#92988F]">
              View and manage your product catalogue.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or SKU..."
              className="h-9 min-w-0 rounded-lg border border-[#D9DED5] bg-[#FDFCF9] px-3 text-[13px] text-[#39443B] outline-none placeholder:text-[#A0A69D] focus:border-[#879B89] sm:w-64"
            />

            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-[#D9DED5] bg-[#FDFCF9] px-3 text-[13px] text-[#465047] outline-none focus:border-[#879B89]"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>

            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[13px]">
            <thead className="bg-[#F4F4EE] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#858D83]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Cost price</th>
                <th className="px-4 py-3 text-right">Selling price</th>
                <th className="px-4 py-3 text-right">Profit margin</th>
                <th className="px-4 py-3">Status</th>
                {canManageProducts && (
                  <th className="px-4 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#ECEDE7]">
              {filteredProducts.map((product) => {
                const cost = Number(product.costPrice);
                const selling = Number(product.sellingPrice);
                const margin =
                  selling > 0 ? ((selling - cost) / selling) * 100 : 0;

                return (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-[#F6F6F0]"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#3E493F]">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="mt-1 max-w-xs truncate text-xs text-[#92988F]">
                          {product.description}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-[#F1F2EC] px-2 py-1 font-mono text-[11px] text-[#687367]">
                        {product.sku}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right tabular-nums text-[#687167]">
                      {formatMoney(product.costPrice)}
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-[#465448]">
                      {formatMoney(product.sellingPrice)}
                    </td>

                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span
                        className={
                          margin >= 0
                            ? "font-medium text-[#66816A]"
                            : "font-medium text-[#B36A61]"
                        }
                      >
                        {margin.toFixed(1)}%
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <Badge>{product.status}</Badge>
                    </td>

                    {canManageProducts && (
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => openEditForm(product)}
                          >
                            Edit
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              setError("");
                              setConfirmProduct(product);
                            }}
                          >
                            {product.status === "ACTIVE"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageProducts ? 7 : 6}
                    className="px-4 py-14 text-center"
                  >
                    <p className="text-sm font-medium text-[#596458]">
                      {products.length === 0
                        ? "No products added yet"
                        : "No matching products"}
                    </p>
                    <p className="mt-1 text-xs text-[#92988F]">
                      {products.length === 0
                        ? "Add your first product to start building your catalogue."
                        : "Try changing your search or status filter."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#E8E9E2] px-4 py-3">
          <p className="text-xs text-[#92988F]">
            Showing{" "}
            <span className="font-medium text-[#596458]">
              {filteredProducts.length}
            </span>{" "}
            of {products.length} products
          </p>
          {hasFilters && (
            <p className="text-[11px] text-[#92988F]">Filters applied</p>
          )}
        </div>
      </section>

      {showForm && (
        <Dialog
          open={showForm}
          title={editingProduct ? "Edit product" : "Add product"}
          onClose={closeForm}
          size="2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5 p-5">
            <div>
              <p className="text-xs text-[#858D83]">
                {editingProduct
                  ? "Update the product details and pricing below."
                  : "Enter the details of the product you want to add."}
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-[#E6C9C3] bg-[#FBF1EF] px-3 py-2.5 text-[13px] text-[#98564F]">
                {error}
              </div>
            )}

            <FormField
              label="Product name"
              htmlFor="product-name"
              required
              labelClassName="text-[13px] font-medium text-[#596458]"
            >
              <Input
                id="product-name"
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className={fieldClass}
                placeholder="e.g. Hair treatment cream"
              />
            </FormField>

            <FormField
              label="SKU"
              htmlFor="product-sku"
              required
              labelClassName="text-[13px] font-medium text-[#596458]"
            >
              <Input
                id="product-sku"
                required
                minLength={2}
                maxLength={50}
                value={form.sku}
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value.toUpperCase() })
                }
                className={`${fieldClass} font-mono uppercase`}
                placeholder="e.g. HAIR-001"
              />
              <p className="text-[11px] text-[#92988F]">
                Each product must have a unique SKU.
              </p>
            </FormField>

            <FormField
              label="Description"
              htmlFor="product-description"
              labelClassName="text-[13px] font-medium text-[#596458]"
            >
              <Textarea
                id="product-description"
                rows={3}
                maxLength={1000}
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                className={`${fieldClass} resize-y`}
                placeholder="Optional product description"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Cost price (₦)"
                htmlFor="product-cost-price"
                required
                labelClassName="text-[13px] font-medium text-[#596458]"
              >
                <Input
                  id="product-cost-price"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(event) =>
                    setForm({ ...form, costPrice: event.target.value })
                  }
                  className={fieldClass}
                  placeholder="0.00"
                />
              </FormField>

              <FormField
                label="Selling price (₦)"
                htmlFor="product-selling-price"
                required
                labelClassName="text-[13px] font-medium text-[#596458]"
              >
                <Input
                  id="product-selling-price"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(event) =>
                    setForm({ ...form, sellingPrice: event.target.value })
                  }
                  className={fieldClass}
                  placeholder="0.00"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E8E9E2] pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={closeForm}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editingProduct
                    ? "Save changes"
                    : "Create product"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {confirmProduct && (
        <Dialog
          open={!!confirmProduct}
          title={
            confirmProduct.status === "ACTIVE"
              ? "Deactivate product"
              : "Activate product"
          }
          onClose={() => {
            if (!isPending) setConfirmProduct(null);
          }}
          size="md"
        >
          <div className="space-y-3 p-5">
            <p className="text-[13px] leading-6 text-[#687167]">
              {confirmProduct.status === "ACTIVE"
                ? "Are you sure you want to deactivate this product? It will no longer be available as an active product."
                : "Are you sure you want to activate this product again?"}
            </p>

            <div className="rounded-lg border border-[#E5E7DF] bg-[#F5F5EF] p-3">
              <p className="text-sm font-medium text-[#3E493F]">
                {confirmProduct.name}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#858D83]">
                {confirmProduct.sku}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E8E9E2] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmProduct(null)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isPending}
              onClick={handleStatusChange}
            >
              {isPending ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
