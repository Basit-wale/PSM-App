import Link from "next/link";

type AccessDeniedProps = {
  title?: string;
  description?: string;
};

export function AccessDenied({
  title = "Access restricted",
  description = "Your account does not have permission to access this page. Contact your organization administrator if you believe this is a mistake.",
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md border border-zinc-200 bg-white p-8">
        <div className="mb-5 flex h-10 w-10 items-center justify-center border border-zinc-200 text-zinc-700">
          <span className="text-lg font-semibold">!</span>
        </div>

        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Error 403
        </p>

        <h1 className="mt-2 text-xl font-semibold text-zinc-900">{title}</h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>

        <Link
          href="/dashboard"
          className="mt-6 inline-flex border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
