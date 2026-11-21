"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSale } from "@/app/actions/sale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type Product = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: string;
  inventory: {
    branchId: string;
    quantity: string;
  }[];
};

type Service = {
  id: string;
  name: string;
  price: string;
  durationMins: number | null;
};

type Sale = {
  id: string;
  receiptNumber: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  createdAt: string;
  branch: { name: string };
  customer: {
    firstName: string;
    lastName: string | null;
  } | null;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }[];
  payments: {
    amount: string;
    method: string;
    status: string;
  }[];
};

type CartItem = {
  type: "PRODUCT" | "SERVICE";
  itemId: string;
  quantity: string;
  assignedMemberId: string;
};

type Staff = {
  id: string;
  name: string;
  branchIds: string[];
};

type Props = {
  branches: Branch[];
  customers: Customer[];
  products: Product[];
  services: Service[];
  sales: Sale[];
  staff: Staff[];
  defaultTaxRate: string;
  canCreateSales: boolean;
};

function money(value: string | number) {
  return Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function paymentLabel(method: string) {
  return method.replaceAll("_", " ");
}

const fieldClass =
  "w-full rounded-lg border border-[#D9DED5] bg-[#FDFCF9] px-3 py-2.5 text-[13px] text-[#39443B] outline-none transition placeholder:text-[#A0A69D] focus:border-[#879B89] focus:ring-2 focus:ring-[#879B89]/15";

const panelClass =
  "overflow-hidden rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] shadow-[0_1px_2px_rgba(40,50,40,0.03)]";

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#E3E5DD] bg-[#FBFAF7] px-4 py-4 shadow-[0_1px_2px_rgba(40,50,40,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#858D83]">
        {label}
      </p>
      <p className="mt-2 text-[21px] font-semibold tracking-tight text-[#354238] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#92988F]">{detail}</p>
    </div>
  );
}

export function SalesManager({
  branches,
  customers,
  products,
  services,
  sales,
  staff,
  defaultTaxRate,
  canCreateSales,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [customerId, setCustomerId] = useState("");
  const [itemType, setItemType] = useState<"PRODUCT" | "SERVICE">("SERVICE");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [branchFilter, setBranchFilter] = useState("ALL");

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

  const availableItems = itemType === "PRODUCT" ? products : services;

  const selectedProduct =
    itemType === "PRODUCT"
      ? products.find((product) => product.id === itemId)
      : undefined;

  const selectedService =
    itemType === "SERVICE"
      ? services.find((service) => service.id === itemId)
      : undefined;

  const selectedStock = selectedProduct?.inventory.find(
    (item) => item.branchId === branchId,
  );

  const availableStock = Number(selectedStock?.quantity ?? 0);

  const cartDetails = useMemo(
    () =>
      cart.map((item) => {
        const product =
          item.type === "PRODUCT"
            ? products.find((entry) => entry.id === item.itemId)
            : undefined;

        const service =
          item.type === "SERVICE"
            ? services.find((entry) => entry.id === item.itemId)
            : undefined;

        const name = product?.name ?? service?.name ?? "Unavailable item";
        const price = Number(product?.sellingPrice ?? service?.price ?? 0);
        const lineTotal = price * Number(item.quantity);

        const assignedStaff = staff.find(
          (member) => member.id === item.assignedMemberId,
        );

        return {
          ...item,
          name,
          price,
          lineTotal,
          assignedStaffName: assignedStaff?.name ?? "Unavailable",
        };
      }),
    [cart, products, services, staff],
  );

  const subtotal = cartDetails.reduce(
    (total, item) => total + item.lineTotal,
    0,
  );

  const discountAmount = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = Number(defaultTaxRate) || 0;
  const taxAmount =
    Math.round(((taxableAmount * taxRate) / 100 + Number.EPSILON) * 100) / 100;
  const total = taxableAmount + taxAmount;

  const filteredSales = sales.filter(
    (sale) =>
      branchFilter === "ALL" ||
      sale.branch.name ===
        branches.find((branch) => branch.id === branchFilter)?.name,
  );

  const paidSales = sales.filter((sale) => sale.status === "PAID").length;

  const recentSalesValue = sales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0,
  );

  function addToCart() {
    setError("");
    setSuccess("");

    if (!itemId) {
      setError("Select an item first.");
      return;
    }

    if (!selectedMemberId) {
      setError("Select the staff member responsible for this item.");
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setError("Enter a valid quantity.");
      return;
    }

    const existingQuantity = cart
      .filter((item) => item.type === itemType && item.itemId === itemId)
      .reduce((sum, item) => sum + Number(item.quantity), 0);

    if (
      itemType === "PRODUCT" &&
      existingQuantity + parsedQuantity > availableStock
    ) {
      setError(`Only ${availableStock} units are available at this branch.`);
      return;
    }

    setCart((current) => [
      ...current,
      {
        type: itemType,
        itemId,
        quantity: parsedQuantity.toString(),
        assignedMemberId: selectedMemberId,
      },
    ]);

    setItemId("");
    setQuantity("1");
  }

  function updateQuantity(index: number, value: string) {
    setCart((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: value } : item,
      ),
    );
  }

  function removeItem(index: number) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function handleCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!branchId || cart.length === 0) {
      setError("Select a branch and add at least one item.");
      return;
    }

    if (
      cart.some(
        (item) =>
          !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0,
      )
    ) {
      setError("Check the quantities in your cart.");
      return;
    }

    const invalidStock = cart.some((item) => {
      if (item.type !== "PRODUCT") return false;

      const product = products.find((entry) => entry.id === item.itemId);
      const stock = product?.inventory.find(
        (entry) => entry.branchId === branchId,
      );

      return Number(item.quantity) > Number(stock?.quantity ?? 0);
    });

    if (invalidStock) {
      setError("One or more products exceed the available branch stock.");
      return;
    }

    if (discountAmount < 0 || discountAmount > subtotal) {
      setError("Check the discount amount.");
      return;
    }

    if (total <= 0) {
      setError("The sale total must be greater than zero.");
      return;
    }

    startTransition(async () => {
      const result = await createSale({
        branchId,
        customerId,
        items: cart,
        paymentMethod,
        discount: discount || "0",
        notes,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(`Sale completed. Receipt: ${result.receiptNumber}`);
      setCart([]);
      setCustomerId("");
      setDiscount("0");
      setNotes("");
      setPaymentMethod("CASH");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#354238]">
            Sales & POS
          </h1>
          <p className="mt-1 text-[13px] text-[#858D83]">
            Process customer purchases, collect payments and review sales.
          </p>
        </div>

        <Badge variant="default">{sales.length} recent sales</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Recent sales"
          value={sales.length.toLocaleString("en-NG")}
          detail="Latest recorded transactions"
        />
        <SummaryCard
          label="Paid transactions"
          value={paidSales.toLocaleString("en-NG")}
          detail="Within the recent sales list"
        />
        <SummaryCard
          label="Recent sales value"
          value={`₦${money(recentSalesValue)}`}
          detail="Total value of listed sales"
        />
      </div>

      {success && (
        <div className="rounded-lg border border-[#D6E2D4] bg-[#F0F5EF] px-4 py-3 text-[13px] text-[#58735B]">
          {success}
        </div>
      )}

      {error && !canCreateSales && (
        <div className="rounded-lg border border-[#E6C9C3] bg-[#FBF1EF] px-4 py-3 text-[13px] text-[#98564F]">
          {error}
        </div>
      )}

      {canCreateSales && (
        <form onSubmit={handleCheckout} className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <section className={panelClass}>
                <div className="border-b border-[#E8E9E2] px-4 py-4">
                  <h2 className="text-sm font-semibold text-[#414C42]">
                    New sale
                  </h2>
                  <p className="mt-1 text-xs text-[#92988F]">
                    Select the branch and customer for this transaction.
                  </p>
                </div>

                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <FormField label="Branch" htmlFor="sale-branch" required>
                    <Select
                      id="sale-branch"
                      value={branchId}
                      onChange={(event) => {
                        setBranchId(event.target.value);
                        setCustomerId("");
                        setSelectedMemberId("");
                        setCart([]);
                        setError("");
                      }}
                      required
                      className={fieldClass}
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} ({branch.code})
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Customer" htmlFor="sale-customer">
                    <Select
                      id="sale-customer"
                      value={customerId}
                      onChange={(event) => setCustomerId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Walk-in customer</option>
                      {availableCustomers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName ?? ""} —{" "}
                          {customer.phone}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </section>

              <section className={panelClass}>
                <div className="border-b border-[#E8E9E2] px-4 py-4">
                  <h2 className="text-sm font-semibold text-[#414C42]">
                    Add items
                  </h2>
                  <p className="mt-1 text-xs text-[#92988F]">
                    Choose a service or product and assign a staff member.
                  </p>
                </div>

                <div className="space-y-4 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Item type" htmlFor="sale-item-type">
                      <Select
                        id="sale-item-type"
                        value={itemType}
                        onChange={(event) => {
                          setItemType(
                            event.target.value as "PRODUCT" | "SERVICE",
                          );
                          setItemId("");
                        }}
                        className={fieldClass}
                      >
                        <option value="SERVICE">Service</option>
                        <option value="PRODUCT">Product</option>
                      </Select>
                    </FormField>

                    <FormField label="Item" htmlFor="sale-item">
                      <Select
                        id="sale-item"
                        value={itemId}
                        onChange={(event) => setItemId(event.target.value)}
                        className={fieldClass}
                      >
                        <option value="">Select item</option>
                        {availableItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} — ₦
                            {money(
                              "sellingPrice" in item
                                ? item.sellingPrice
                                : item.price,
                            )}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <FormField
                    label="Responsible staff"
                    htmlFor="sale-staff"
                    required
                  >
                    <Select
                      id="sale-staff"
                      value={selectedMemberId}
                      onChange={(event) =>
                        setSelectedMemberId(event.target.value)
                      }
                      required
                      className={fieldClass}
                    >
                      <option value="">Select staff member</option>
                      {availableStaff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  {selectedProduct && (
                    <div className="rounded-lg border border-[#E2E7DF] bg-[#F2F5F0] px-3 py-2.5">
                      <p className="text-xs text-[#667666]">
                        Available stock at this branch
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#465B49] tabular-nums">
                        {availableStock} units
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-32">
                      <FormField label="Quantity" htmlFor="sale-quantity">
                        <Input
                          id="sale-quantity"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value)}
                          className={fieldClass}
                        />
                      </FormField>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addToCart}
                      disabled={!itemId}
                    >
                      Add item
                    </Button>
                  </div>
                </div>
              </section>

              <section className={panelClass}>
                <div className="flex items-center justify-between border-b border-[#E8E9E2] px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-[#414C42]">
                      Cart
                    </h2>
                    <p className="mt-1 text-xs text-[#92988F]">
                      Review items before completing the sale.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E9EEE8] px-2.5 py-1 text-xs font-medium text-[#58705B]">
                    {cart.length} item(s)
                  </span>
                </div>

                {cart.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-[#596458]">
                      Your cart is empty
                    </p>
                    <p className="mt-1 text-xs text-[#92988F]">
                      Add a service or product to begin this sale.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-[13px]">
                      <thead className="bg-[#F4F4EE] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#858D83]">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-3 py-3">Staff</th>
                          <th className="px-3 py-3 text-right">Price</th>
                          <th className="px-3 py-3">Qty</th>
                          <th className="px-3 py-3 text-right">Total</th>
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECEDE7]">
                        {cartDetails.map((item, index) => (
                          <tr
                            key={`${item.type}-${item.itemId}-${index}`}
                            className="hover:bg-[#F6F6F0]"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#414C42]">
                                {item.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#92988F]">
                                {item.type === "PRODUCT"
                                  ? "Product"
                                  : "Service"}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-xs text-[#687167]">
                              {item.assignedStaffName}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-[#687167]">
                              {money(item.price)}
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                aria-label={`Quantity for ${item.name}`}
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateQuantity(index, event.target.value)
                                }
                                className="h-8 w-20 rounded-md border border-[#D9DED5] bg-[#FDFCF9] px-2 text-[12px] outline-none focus:border-[#879B89]"
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-medium tabular-nums text-[#465448]">
                              {money(item.lineTotal)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => removeItem(index)}
                              >
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {cart.length > 0 && (
                  <div className="flex justify-between border-t border-[#E8E9E2] px-4 py-3 text-xs">
                    <span className="text-[#858D83]">Cart subtotal</span>
                    <span className="font-semibold text-[#465448] tabular-nums">
                      ₦{money(subtotal)}
                    </span>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-4 xl:sticky xl:top-5">
              <section className={panelClass}>
                <div className="border-b border-[#E8E9E2] px-4 py-4">
                  <h2 className="text-sm font-semibold text-[#414C42]">
                    Payment summary
                  </h2>
                  <p className="mt-1 text-xs text-[#92988F]">
                    Review the amount due and payment method.
                  </p>
                </div>

                <div className="space-y-4 p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#858D83]">Subtotal</span>
                      <span className="font-medium text-[#465047] tabular-nums">
                        ₦{money(subtotal)}
                      </span>
                    </div>

                    <FormField label="Discount (₦)" htmlFor="sale-discount">
                      <Input
                        id="sale-discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={(event) => setDiscount(event.target.value)}
                        className={fieldClass}
                      />
                    </FormField>

                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#858D83]">
                        Tax ({money(taxRate)}%)
                      </span>
                      <span className="font-medium text-[#465047] tabular-nums">
                        ₦{money(taxAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#DDE5DA] bg-[#F0F4EE] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#748474]">
                      Total payable
                    </p>
                    <p className="mt-2 text-[26px] font-semibold tracking-tight text-[#3D5541] tabular-nums">
                      ₦{money(total)}
                    </p>
                  </div>

                  <FormField
                    label="Payment method"
                    htmlFor="sale-payment"
                    required
                  >
                    <Select
                      id="sale-payment"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="CASH">Cash</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="CARD">Card</option>
                      <option value="MOBILE_MONEY">Mobile money</option>
                      <option value="OTHER">Other</option>
                    </Select>
                  </FormField>

                  <FormField label="Notes" htmlFor="sale-notes">
                    <Textarea
                      id="sale-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional sale notes..."
                      className={`${fieldClass} resize-y`}
                    />
                  </FormField>

                  {error && (
                    <div className="rounded-lg border border-[#E6C9C3] bg-[#FBF1EF] px-3 py-2.5 text-[13px] text-[#98564F]">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      isPending ||
                      !branchId ||
                      cart.length === 0 ||
                      !canCreateSales
                    }
                  >
                    {isPending ? "Processing sale..." : "Complete sale"}
                  </Button>

                  <p className="text-[11px] leading-5 text-[#92988F]">
                    Completing the sale records payment and deducts product
                    stock from the selected branch.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </form>
      )}

      <section className={panelClass}>
        <div className="flex flex-col justify-between gap-3 border-b border-[#E8E9E2] px-4 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-[#414C42]">
              Sales history
            </h2>
            <p className="mt-1 text-xs text-[#92988F]">
              Review your latest 100 sales and transaction details.
            </p>
          </div>

          <div className="w-full sm:w-52">
            <Select
              aria-label="Filter sales by branch"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className={fieldClass}
            >
              <option value="ALL">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-[13px]">
            <thead className="bg-[#F4F4EE] text-[10px] font-semibold uppercase tracking-[0.07em] text-[#858D83]">
              <tr>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#ECEDE7]">
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="transition-colors hover:bg-[#F6F6F0]"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-[#414C42]">
                      {sale.receiptNumber}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#92988F]">
                      {sale.items.length} item(s)
                    </p>
                  </td>

                  <td className="px-4 py-3.5 text-xs text-[#687167]">
                    {new Date(sale.createdAt).toLocaleString()}
                  </td>

                  <td className="px-4 py-3.5 text-[#596458]">
                    {sale.customer
                      ? `${sale.customer.firstName} ${sale.customer.lastName ?? ""}`
                      : "Walk-in"}
                  </td>

                  <td className="px-4 py-3.5 text-[#687167]">
                    {sale.branch.name}
                  </td>

                  <td className="px-4 py-3.5 text-xs capitalize text-[#687167]">
                    {sale.payments[0]
                      ? paymentLabel(sale.payments[0].method)
                      : "—"}
                  </td>

                  <td className="px-4 py-3.5">
                    <Badge>{sale.status}</Badge>
                  </td>

                  <td className="px-4 py-3.5 text-right font-medium tabular-nums text-[#465448]">
                    ₦{money(sale.total)}
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-[#596458]">
                      No sales found
                    </p>
                    <p className="mt-1 text-xs text-[#92988F]">
                      Sales will appear here after transactions are completed.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-[#E8E9E2] px-4 py-3">
          <p className="text-xs text-[#92988F]">
            Showing {filteredSales.length} of {sales.length} recent sales
          </p>
        </div>
      </section>
    </div>
  );
}
