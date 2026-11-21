"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { authClient } from "@/lib/auth-client";
import { acceptStaffInvitation } from "@/app/actions/accept-staff-invitation";

type InvitationAcceptanceProps = {
  token: string;
  organizationName: string;
  invitedEmail: string;
  role: string;
  branches: string[];
  expiresAt: string;
  isSignedIn: boolean;
  signedInEmail: string | null;
};

export function InvitationAcceptance({
  token,
  organizationName,
  invitedEmail,
  role,
  branches,
  expiresAt,
  isSignedIn,
  signedInEmail,
}: InvitationAcceptanceProps) {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function completeInvitation() {
    const result = await acceptStaffInvitation(token);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSuccess("Your invitation has been accepted.");
    router.push("/dashboard");
    router.refresh();
  }

  async function handleAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== invitedEmail.toLowerCase()) {
      setError("Use the email address this invitation was sent to.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error: authError } = await authClient.signIn.email({
          email: normalizedEmail,
          password,
        });

        if (authError) {
          setError(authError.message || "Unable to sign in.");
          return;
        }
      } else {
        const { error: authError } = await authClient.signUp.email({
          name: name.trim(),
          email: normalizedEmail,
          password,
        });

        if (authError) {
          setError(authError.message || "Unable to create your account.");
          return;
        }
      }

      await completeInvitation();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setLoading(true);

    try {
      const { error: signOutError } = await authClient.signOut();

      if (signOutError) {
        setError(signOutError.message || "Unable to sign out.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await completeInvitation();
    } catch {
      setError("Unable to accept the invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formattedRole = role
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Salon Manager
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Staff invitation</p>
        </div>

        <section className="border border-zinc-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-zinc-900">
            You&apos;ve been invited
          </h2>

          <p className="mt-2 text-sm text-zinc-600">
            You have been invited to join{" "}
            <strong className="font-semibold text-zinc-900">
              {organizationName}
            </strong>
            .
          </p>

          <div className="mt-6 border-y border-zinc-200 py-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Email</dt>
                <dd className="break-all text-right font-medium text-zinc-900">
                  {invitedEmail}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Role</dt>
                <dd className="text-right font-medium text-zinc-900">
                  {formattedRole}
                </dd>
              </div>

              <div>
                <dt className="text-zinc-500">Assigned branches</dt>
                <dd className="mt-1 font-medium text-zinc-900">
                  {branches.length > 0
                    ? branches.join(", ")
                    : "All active branches"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Expires</dt>
                <dd className="text-right font-medium text-zinc-900">
                  {expiresAt}
                </dd>
              </div>
            </dl>
          </div>

          {isSignedIn ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-zinc-600">
                Signed in as{" "}
                <strong className="font-medium text-zinc-900">
                  {signedInEmail}
                </strong>
              </p>

              <Button
                type="button"
                className="w-full"
                onClick={handleAccept}
                disabled={loading}
              >
                {loading ? "Accepting invitation..." : "Accept invitation"}
              </Button>

              <p className="text-xs text-zinc-500">
                If this is not the invited email address, sign out and switch to
                the correct account.
              </p>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
                disabled={loading}
              >
                Sign out and switch account
              </Button>

              {error && (
                <div
                  role="alert"
                  className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 border-b border-zinc-200">
                <Button
                  type="button"
                  variant="ghost"
                  className={`w-full border-b-2 px-3 py-3 ${
                    mode === "signin"
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-500"
                  }`}
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                >
                  Sign in
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className={`w-full border-b-2 px-3 py-3 ${
                    mode === "signup"
                      ? "border-zinc-900 text-zinc-900"
                      : "border-transparent text-zinc-500"
                  }`}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  Create account
                </Button>
              </div>

              <form onSubmit={handleAuthentication} className="mt-5 space-y-4">
                {mode === "signup" && (
                  <FormField label="Full name" htmlFor="invite-name">
                    <Input
                      id="invite-name"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
                      placeholder="Your full name"
                    />
                  </FormField>
                )}

                <FormField label="Email address" htmlFor="invite-email">
                  <Input
                    id="invite-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    readOnly
                    className="w-full border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600 outline-none"
                  />
                </FormField>

                <FormField label="Password" htmlFor="invite-password">
                  <Input
                    id="invite-password"
                    type="password"
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Your password"
                    }
                  />
                </FormField>

                {mode === "signup" && (
                  <FormField
                    label="Confirm password"
                    htmlFor="invite-confirm-password"
                  >
                    <Input
                      id="invite-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      className="w-full border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900"
                      placeholder="Enter your password again"
                    />
                  </FormField>
                )}

                {error && (
                  <div
                    role="alert"
                    className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                {success && (
                  <p role="status" className="text-sm text-zinc-700">
                    {success}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Please wait..."
                    : mode === "signin"
                      ? "Sign in and accept invitation"
                      : "Create account and accept invitation"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-xs text-zinc-500">
            Having trouble? Contact the person who invited you.
          </p>
        </section>

        <p className="mt-5 text-center text-sm text-zinc-500">
          <Link href="/login" className="text-zinc-900 underline">
            Go to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
