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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Business configuration
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organization information and default business
            preferences.
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
        <div className="rounded-lg border border-[#E1E5DD] bg-[#F0F2ED] px-4 py-3 text-sm text-[#657066]">
          You can view these settings, but only an organization owner can update
          them.
        </div>
      )}

      <section className="settings-section rounded-xl border border-[#E1E5DD] bg-[#FBFAF7] p-5 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E9EEE8] text-[#617968]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-[18px]"
              aria-hidden="true"
            >
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
              <path d="M9 9v.01M9 13v.01M9 17v.01M15 13v.01M15 17v.01" />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-semibold">Organization details</h3>
            <p className="mt-1 text-sm text-muted-foreground">
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

        <p className="mt-4 text-xs text-muted-foreground">
          Your organization slug is a permanent identifier and cannot be changed
          here.
        </p>
      </section>

      <section className="settings-section rounded-xl border border-[#E1E5DD] bg-[#FBFAF7] p-5 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E9EEE8] text-[#617968]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-[18px]"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-semibold">Regional preferences</h3>
            <p className="mt-1 text-sm text-muted-foreground">
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

      <section className="settings-section rounded-xl border border-[#E1E5DD] bg-[#FBFAF7] p-5 sm:p-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E9EEE8] text-[#617968]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="size-[18px]"
              aria-hidden="true"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-semibold">Tax settings</h3>
            <p className="mt-1 text-sm text-muted-foreground">
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

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Enter 0 if your business does not charge tax. This rate will be used
            to calculate tax on POS sales.
          </p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-lg border border-[#D5E3D4] bg-[#EEF4EC] px-4 py-3 text-sm text-[#526D55]"
        >
          {message}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end border-t border-[#E1E5DD] pt-5">
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving settings..." : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
