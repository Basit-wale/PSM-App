"use client";

import { useState, useTransition } from "react";
import { updateOrganizationSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";

type Settings = {
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  defaultTaxRate: string;
};

const currencies = [
  { value: "NGN", label: "NGN - Nigerian Naira" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GHS", label: "GHS - Ghanaian Cedi" },
  { value: "KES", label: "KES - Kenyan Shilling" },
  { value: "ZAR", label: "ZAR - South African Rand" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
];

const timezones = [
  { value: "Africa/Lagos", label: "Africa/Lagos (West Africa)" },
  { value: "Africa/Accra", label: "Africa/Accra (Ghana)" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (East Africa)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Los_Angeles", label: "America/Los Angeles" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "UTC", label: "UTC" },
];

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#DFE7DC] bg-[#EDF2EA] text-[#58745E]">
      {children}
    </div>
  );
}

export function SettingsManager({
  initialSettings,
  canManage,
}: {
  initialSettings: Settings;
  canManage: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof Settings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSave() {
    setMessage("");
    setError("");

    startTransition(async () => {
      const result = await updateOrganizationSettings({
        name: settings.name,
        currency: settings.currency,
        timezone: settings.timezone,
        defaultTaxRate: settings.defaultTaxRate,
      });

      if (!result.success) {
        setError(result.error ?? "Unable to save settings.");
        return;
      }

      setMessage(result.message ?? "Settings saved successfully.");
    });
  }

  return (
    <div className="settings-page space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#71816F]">
              Workspace
            </span>
            <span className="size-1 rounded-full bg-[#9BAE96]" />
            <span className="text-[11px] font-medium text-[#8A9386]">
              Configuration
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[#26392D]">
            Business settings
          </h2>

          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#788276]">
            Manage your organization information and default business
            preferences from one place.
          </p>
        </div>

        {canManage && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="sm:min-w-36"
          >
            {isPending ? "Saving..." : "Save settings"}
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="flex items-start gap-3 rounded-xl border border-[#E4E8DF] bg-[#F1F3EE] px-4 py-3.5 text-sm text-[#657366]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <p>
            You can view these settings, but only an organization owner can
            update them.
          </p>
        </div>
      )}

      {/* Organization details */}
      <section className="settings-section rounded-2xl border border-[#E2E7DE] bg-[#FBFAF7] p-5 shadow-[0_2px_10px_rgba(38,57,45,0.025)] sm:p-6">
        <div className="mb-6 flex items-start gap-3.5">
          <SectionIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              <path d="M9 9v.01M9 13v.01M9 17v.01M15 13v.01M15 17v.01" />
            </svg>
          </SectionIcon>

          <div className="pt-0.5">
            <h3 className="text-[15px] font-semibold text-[#304536]">
              Organization details
            </h3>
            <p className="mt-1 text-sm leading-5 text-[#81897E]">
              Basic information about your salon business.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Business name" htmlFor="businessName">
            <Input
              id="businessName"
              value={settings.name}
              onChange={(event) => updateField("name", event.target.value)}
              disabled={!canManage || isPending}
              placeholder="Enter business name"
            />
          </FormField>

          <FormField label="Organization slug" htmlFor="organizationSlug">
            <Input id="organizationSlug" value={settings.slug} disabled />
          </FormField>
        </div>

        <div className="mt-4 flex items-start gap-2 border-t border-[#EAEBE5] pt-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="mt-0.5 size-4 shrink-0 text-[#879483]"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <p className="text-xs leading-5 text-[#858D81]">
            Your organization slug is a permanent identifier and cannot be
            changed here.
          </p>
        </div>
      </section>

      {/* Regional preferences */}
      <section className="settings-section rounded-2xl border border-[#E2E7DE] bg-[#FBFAF7] p-5 shadow-[0_2px_10px_rgba(38,57,45,0.025)] sm:p-6">
        <div className="mb-6 flex items-start gap-3.5">
          <SectionIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </SectionIcon>

          <div className="pt-0.5">
            <h3 className="text-[15px] font-semibold text-[#304536]">
              Regional preferences
            </h3>
            <p className="mt-1 text-sm leading-5 text-[#81897E]">
              Choose the currency and time zone used by your business.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Business currency" htmlFor="currency">
            <Select
              id="currency"
              value={settings.currency}
              onChange={(event) => updateField("currency", event.target.value)}
              disabled={!canManage || isPending}
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Business time zone" htmlFor="timezone">
            <Select
              id="timezone"
              value={settings.timezone}
              onChange={(event) => updateField("timezone", event.target.value)}
              disabled={!canManage || isPending}
            >
              {!timezones.some((item) => item.value === settings.timezone) && (
                <option value={settings.timezone}>{settings.timezone}</option>
              )}

              {timezones.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </section>

      {/* Tax settings */}
      <section className="settings-section rounded-2xl border border-[#E2E7DE] bg-[#FBFAF7] p-5 shadow-[0_2px_10px_rgba(38,57,45,0.025)] sm:p-6">
        <div className="mb-6 flex items-start gap-3.5">
          <SectionIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </SectionIcon>

          <div className="pt-0.5">
            <h3 className="text-[15px] font-semibold text-[#304536]">
              Tax settings
            </h3>
            <p className="mt-1 text-sm leading-5 text-[#81897E]">
              Configure the default tax percentage applied to POS sales.
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <FormField label="Default tax rate (%)" htmlFor="defaultTaxRate">
            <Input
              id="defaultTaxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={settings.defaultTaxRate}
              onChange={(event) =>
                updateField("defaultTaxRate", event.target.value)
              }
              disabled={!canManage || isPending}
              placeholder="0"
            />
          </FormField>

          <p className="mt-2.5 text-xs leading-5 text-[#858D81]">
            Enter 0 if your business does not charge tax. This rate will be used
            to calculate tax on POS sales.
          </p>
        </div>
      </section>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[#F0D6D2] bg-[#FFF5F3] px-4 py-3.5 text-sm text-[#A34E43]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-[#D7E4D3] bg-[#EFF5EC] px-4 py-3.5 text-sm text-[#526D55]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
          {message}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end border-t border-[#E2E7DE] pt-5">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="min-w-36"
          >
            {isPending ? "Saving settings..." : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
