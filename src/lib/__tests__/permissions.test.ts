
import { describe, expect, it } from "vitest";
import { MemberRole } from "@/generated/prisma/client";
import {
  hasPermission,
  ROLE_PERMISSIONS,
} from "../permissions";

describe("Role-based permissions", () => {
  it("allows owners all permissions", () => {
    expect(ROLE_PERMISSIONS[MemberRole.OWNER].length).toBeGreaterThan(0);

    expect(
      hasPermission(MemberRole.OWNER, "organization:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.OWNER, "accounting:manage")
    ).toBe(true);
  });

  it("does not allow admins to manage organization ownership settings", () => {
    expect(
      hasPermission(MemberRole.ADMIN, "organization:manage")
    ).toBe(false);

    expect(
      hasPermission(MemberRole.ADMIN, "members:manage")
    ).toBe(true);
  });

  it("restricts receptionists to front-desk operations", () => {
    expect(
      hasPermission(MemberRole.RECEPTIONIST, "appointments:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.RECEPTIONIST, "sales:create")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.RECEPTIONIST, "accounting:manage")
    ).toBe(false);

    expect(
      hasPermission(MemberRole.RECEPTIONIST, "inventory:manage")
    ).toBe(false);
  });

  it("restricts inventory managers to inventory-related operations", () => {
    expect(
      hasPermission(MemberRole.INVENTORY_MANAGER, "inventory:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.INVENTORY_MANAGER, "products:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.INVENTORY_MANAGER, "payments:refund")
    ).toBe(false);
  });

  it("restricts accountants to financial operations", () => {
    expect(
      hasPermission(MemberRole.ACCOUNTANT, "accounting:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.ACCOUNTANT, "expenses:approve")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.ACCOUNTANT, "appointments:manage")
    ).toBe(false);
  });

  it("restricts CRM managers to customer relationship operations", () => {
    expect(
      hasPermission(MemberRole.CRM_MANAGER, "crm:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.CRM_MANAGER, "campaigns:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.CRM_MANAGER, "inventory:manage")
    ).toBe(false);
  });

  it("does not grant branch managers accounting management access", () => {
    expect(
      hasPermission(MemberRole.BRANCH_MANAGER, "appointments:manage")
    ).toBe(true);

    expect(
      hasPermission(MemberRole.BRANCH_MANAGER, "accounting:manage")
    ).toBe(false);
  });
});
