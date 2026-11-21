"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scissors, Eye, EyeOff } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError(authError.message || "Registration failed.");
        return;
      }

      router.push("/setup");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Scissors size={28} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Salon Manager
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Create your account to manage your salon.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-zinc-900">
            Create an account
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Get started with your salon management workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Full name
              </label>

              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                Confirm password
              </label>

              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Enter your password again"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-zinc-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Secure salon management for your business.
        </p>
      </div>
    </main>
  );
}
