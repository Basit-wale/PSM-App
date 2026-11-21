
import { MemberRole } from "@/generated/prisma/client";

export const PERMISSIONS = [
  // Organization
  "organization:read",
  "organization:manage",

  // Branches and staff
  "branches:read",
  "branches:manage",
  "members:read",
  "members:manage",

  // Services and products
  "services:read",
  "services:manage",
  "products:read",
  "products:manage",

  // Inventory
  "inventory:read",
  "inventory:manage",
  "inventory:transfer",

  // Customers and CRM
  "customers:read",
  "customers:manage",
  "crm:manage",
  "campaigns:manage",

  // Appointments
  "appointments:read",
  "appointments:manage",

  // Sales and payments
  "sales:read",
  "sales:create",
  "sales:void",
  "payments:read",
  "payments:manage",
  "payments:refund",

  // Expenses and accounting
  "expenses:read",
  "expenses:create",
  "expenses:approve",
  "accounting:read",
  "accounting:manage",

  // Reports and audit
  "reports:read",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<
  MemberRole,
  readonly Permission[]
> = {
  OWNER: ALL_PERMISSIONS,

  ADMIN: ALL_PERMISSIONS.filter(
    (permission) => permission !== "organization:manage"
  ),

  BRANCH_MANAGER: [
    "branches:read",
    "members:read",
    "services:read",
    "services:manage",
    "products:read",
    "products:manage",
    "inventory:read",
    "inventory:manage",
    "inventory:transfer",
    "customers:read",
    "customers:manage",
    "appointments:read",
    "appointments:manage",
    "sales:read",
    "sales:create",
    "sales:void",
    "payments:read",
    "payments:manage",
    "expenses:read",
    "expenses:create",
    "reports:read",
  ],

  ACCOUNTANT: [
    "branches:read",
    "customers:read",
    "sales:read",
    "payments:read",
    "expenses:read",
    "expenses:approve",
    "accounting:read",
    "accounting:manage",
    "reports:read",
    "audit:read",
  ],

  INVENTORY_MANAGER: [
    "branches:read",
    "products:read",
    "products:manage",
    "inventory:read",
    "inventory:manage",
    "inventory:transfer",
    "reports:read",
  ],

  RECEPTIONIST: [
    "branches:read",
    "services:read",
    "products:read",
    "customers:read",
    "customers:manage",
    "appointments:read",
    "appointments:manage",
    "sales:read",
    "sales:create",
    "payments:read",
    "payments:manage",
  ],

  CRM_MANAGER: [
    "branches:read",
    "customers:read",
    "customers:manage",
    "crm:manage",
    "campaigns:manage",
    "appointments:read",
    "reports:read",
  ],
};

export function hasPermission(
  role: MemberRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
