import * as React from "react";
import { cn } from "cn";

type BadgeVariant =
  "default" | "success" | "muted" | "warning" | "destructive" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  default: "border-[#DCE4DB] bg-[#EDF1EB] text-[#526957]",
  success: "border-[#C8DEC9] bg-[#E1F0E2] text-[#347443]",
  muted: "border-[#E4E4DC] bg-[#F1F1EC] text-[#777F76]",
  warning: "border-[#E9DFC6] bg-[#F8F0DC] text-[#98712A]",
  destructive: "border-[#E8D5D2] bg-[#F8E8E6] text-[#AD4F48]",
  info: "border-[#D3E0ED] bg-[#E8F0F8] text-[#456E99]",
};

const statusVariants: Record<string, BadgeVariant> = {
  PAID: "success",
  COMPLETED: "success",
  ACTIVE: "success",
  CONFIRMED: "success",
  APPROVED: "warning",
  OPEN: "success",
  AVAILABLE: "success",
  IN_STOCK: "success",
  DELIVERED: "success",

  PENDING: "warning",
  PARTIAL: "warning",
  PARTIALLY_PAID: "warning",
  PROCESSING: "info",
  IN_PROGRESS: "info",
  SCHEDULED: "info",

  REJECTED: "destructive",
  CANCELLED: "destructive",
  CANCELED: "destructive",
  VOIDED: "destructive",
  VOID: "destructive",
  OVERDUE: "destructive",
  FAILED: "destructive",
  OUT_OF_STOCK: "destructive",
  LOW_STOCK: "warning",

  DRAFT: "muted",
  INACTIVE: "muted",
  DISABLED: "muted",
};

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  const status = String(children ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  // Recognized statuses always take priority over manually supplied variants.
  const resolvedVariant = statusVariants[status] ?? variant ?? "muted";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
        variants[resolvedVariant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
