"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle, ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type ProfileMenuProps = {
  name: string;
  email: string;
  role: string;
};

export function ProfileMenu({ name, email, role }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      setLoading(false);
    }
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition hover:bg-[#F0F1EB]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#294333] text-xs font-semibold text-white">
          {initials || "U"}
        </div>

        <div className="hidden text-left sm:block">
          <p className="text-xs font-semibold text-[#354338]">{name}</p>
          <p className="text-[10px] text-[#92998F]">
            {role.replaceAll("_", " ")}
          </p>
        </div>

        <ChevronDown size={14} className="text-[#858D84]" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close profile menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-[#E8E8E1] bg-white p-2 shadow-lg">
            <div className="border-b border-[#EEEEEA] px-3 py-3">
              <div className="flex items-center gap-2">
                <UserCircle size={17} className="text-[#718071]" />
                <p className="text-sm font-semibold text-[#354338]">{name}</p>
              </div>
              <p className="mt-1 break-all pl-6 text-xs text-[#92998F]">
                {email}
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleLogout}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut size={16} />
              {loading ? "Logging out..." : "Log out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
