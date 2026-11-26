"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Package,
  Warehouse,
  Receipt,
  Wallet,
  BookOpen,
  ChartNoAxesCombined,
  Building2,
  UserCog,
  Settings,
  UserRound,
  ClipboardList,
} from "lucide-react";

const workspaceLinks = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Appointments",
    href: "/dashboard/appointments",
    icon: CalendarDays,
  },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  {
    label: "Customer Analytics",
    href: "/dashboard/customer-analytics",
    icon: UserRound,
  },
  { label: "Services", href: "/dashboard/services", icon: Scissors },
  { label: "Products", href: "/dashboard/products", icon: Package },
  { label: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
  { label: "Sales", href: "/dashboard/sales", icon: Receipt },
  { label: "Expenses", href: "/dashboard/expenses", icon: Wallet },
  { label: "Accounting", href: "/dashboard/accounting", icon: BookOpen },
  { label: "Reports", href: "/dashboard/reports", icon: ChartNoAxesCombined },
];

const administrationLinks = [
  { label: "Branches", href: "/dashboard/branches", icon: Building2 },
  { label: "Staff & Permissions", href: "/dashboard/staff", icon: UserCog },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  {
    label: "Manual Performance",
    href: "/dashboard/manual-performance",
    icon: ClipboardList,
  },
  {
    label: "Consolidated Revenue",
    href: "/dashboard/consolidated-revenue",
    icon: ChartNoAxesCombined,
  },
];

type NavigationLink = {
  label: string;
  href: string;
  icon: React.ElementType;
};

function NavigationGroup({
  title,
  links,
}: {
  title: string;
  links: NavigationLink[];
}) {
  const pathname = usePathname();

  return (
    <div className="mb-7">
      <h2 className="mb-2 px-4 text-[10px] font-medium uppercase tracking-[0.12em] text-[#92998F]">
        {title}
      </h2>

      <nav className="space-y-0.5">
        {links.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`mx-2 flex items-center gap-3 border-l-2 px-3 py-[9px] text-[12.5px] transition-colors duration-150 ${
                active
                  ? "border-[#718575] bg-[#E9EEE8] font-medium text-[#46594B]"
                  : "border-transparent text-[#626B63] hover:bg-[#EEF0EB] hover:text-[#343B35]"
              }`}
            >
              <Icon
                size={16}
                strokeWidth={1.6}
                className={active ? "text-[#718575]" : "text-[#858D84]"}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function DashboardNavigation({ role }: { role: string }) {
  const canAccessFinancialModules = role === "OWNER" || role === "ACCOUNTANT";

  const visibleWorkspaceLinks = workspaceLinks.filter(
    (link) =>
      canAccessFinancialModules ||
      !["/dashboard/accounting", "/dashboard/reports"].includes(link.href),
  );

  const visibleAdministrationLinks = administrationLinks.filter(
    (link) =>
      ![
        "/dashboard/manual-performance",
        "/dashboard/consolidated-revenue",
      ].includes(link.href) || role === "OWNER",
  );

  return (
    <>
      <NavigationGroup title="Workspace" links={visibleWorkspaceLinks} />
      <NavigationGroup
        title="Administration"
        links={visibleAdministrationLinks}
      />
    </>
  );
}
