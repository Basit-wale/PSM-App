"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DashboardNavigation } from "@/components/shared/dashboard-navigation";
import { ProfileMenu } from "@/components/shared/profile-menu";

type DashboardShellProps = {
  children: React.ReactNode;
  role: string;
  organizationName: string;
  branchCount: number;
  userName: string;
  userEmail: string;
};

export function DashboardShell({
  children,
  role,
  organizationName,
  branchCount,
  userName,
  userEmail,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebar = (
    <>
      <div className="flex h-[68px] items-center border-b border-[#E5E6DF] px-5">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.07em] text-[#46594B]">
            SALON MANAGER
          </p>
          <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-[#92998F]">
            Business management
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <DashboardNavigation role={role} />
      </div>

      <div className="border-t border-[#E5E6DF] px-5 py-4">
        <p className="truncate text-[12px] font-medium text-[#465047]">
          {organizationName}
        </p>
        <p className="mt-1 text-[10px] text-[#858D84]">
          {branchCount} active {branchCount === 1 ? "branch" : "branches"}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F6F1] text-[#343B35]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#E5E6DF] bg-[#F1F2EC] md:flex">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/35"
          />

          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[#E5E6DF] bg-[#F1F2EC] shadow-xl">
            <div className="absolute right-3 top-5 z-10">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-[#626B63] hover:bg-[#E5E9E1]"
              >
                <X size={19} />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 min-h-screen flex-1 flex-col md:ml-60">
        <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between gap-3 border-b border-[#E8E8E1] bg-[#FBFAF7] px-4 py-3 md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              className="shrink-0 rounded-md p-2 text-[#46594B] transition-colors hover:bg-[#EEF0EB] md:hidden"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[#465047]">
                {organizationName}
              </p>
              <p className="mt-0.5 text-[10px] text-[#92998F]">
                {branchCount} active {branchCount === 1 ? "branch" : "branches"}
              </p>
            </div>
          </div>

          <ProfileMenu name={userName} email={userEmail} role={role} />
        </header>

        <main className="min-w-0 flex-1 bg-[#F7F6F1] p-4 sm:p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
