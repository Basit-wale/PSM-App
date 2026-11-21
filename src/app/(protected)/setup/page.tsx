"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Scissors, MapPin, Phone } from "lucide-react";
import { setupOrganization } from "@/app/actions/organization";

export default function SetupPage() {
  const router = useRouter();

  const [organizationName, setOrganizationName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("MAIN");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await setupOrganization({
        organizationName,
        branchName,
        branchCode,
        address,
        phone,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

  const labelClass = "mb-2 block text-sm font-medium text-zinc-700";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Scissors size={28} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Set up your salon
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Let's create your salon workspace and first branch.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-7">
            <section>
              <h2 className="text-base font-semibold text-zinc-900">
                Salon information
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Enter the name of your salon business.
              </p>

              <div className="mt-5">
                <label htmlFor="organizationName" className={labelClass}>
                  Salon business name *
                </label>

                <input
                  id="organizationName"
                  required
                  minLength={2}
                  maxLength={100}
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="e.g. Elite Beauty Studio"
                  className={inputClass}
                />
              </div>
            </section>

            <div className="border-t border-zinc-100" />

            <section>
              <h2 className="text-base font-semibold text-zinc-900">
                First branch
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                You can add more branches later.
              </p>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="branchName" className={labelClass}>
                    Branch name *
                  </label>

                  <input
                    id="branchName"
                    required
                    minLength={2}
                    maxLength={100}
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    placeholder="e.g. Main Branch"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="branchCode" className={labelClass}>
                    Branch code *
                  </label>

                  <input
                    id="branchCode"
                    required
                    minLength={2}
                    maxLength={20}
                    pattern="[A-Za-z0-9-]+"
                    value={branchCode}
                    onChange={(event) =>
                      setBranchCode(event.target.value.toUpperCase())
                    }
                    placeholder="e.g. MAIN"
                    className={inputClass}
                  />

                  <p className="mt-1 text-xs text-zinc-400">
                    Letters, numbers and hyphens only.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="address" className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <MapPin size={15} />
                    Branch address
                  </span>
                </label>

                <textarea
                  id="address"
                  rows={3}
                  maxLength={255}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Enter your salon's address"
                  className={inputClass}
                />
              </div>

              <div className="mt-5">
                <label htmlFor="phone" className={labelClass}>
                  <span className="inline-flex items-center gap-2">
                    <Phone size={15} />
                    Branch phone number
                  </span>
                </label>

                <input
                  id="phone"
                  type="tel"
                  maxLength={30}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter branch phone number"
                  className={inputClass}
                />
              </div>
            </section>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Setting up your salon..." : "Create salon workspace"}
            </button>

            <p className="text-center text-xs text-zinc-400">
              Your account will automatically become the salon owner.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
