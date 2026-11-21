"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  const isForbidden =
    error.message === "ACCESS_DENIED" ||
    error.message.includes("permission") ||
    error.message.includes("access to this branch");

  const isNotFound = error.message === "RESOURCE_NOT_FOUND";

  const title = isForbidden
    ? "Access restricted"
    : isNotFound
      ? "Page or resource not found"
      : "Something went wrong";

  const description = isForbidden
    ? "Your account does not have permission to access this page. Contact your administrator if you need access."
    : isNotFound
      ? "The requested page or resource could not be found, or is no longer available."
      : "An unexpected error occurred. Please try again. If the problem continues, contact support.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-200 bg-white p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {isForbidden
            ? "Error 403"
            : isNotFound
              ? "Error 404"
              : "Application error"}
        </p>

        <h1 className="mt-2 text-xl font-semibold text-zinc-900">{title}</h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
