import * as React from "react";
import { cn } from "cn";

type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  description?: string;
  className?: string;
  labelClassName?: string;
  children: React.ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required,
  error,
  description,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          "block text-[12px] font-medium tracking-[0.01em] text-[#505A51]",
          labelClassName,
        )}
      >
        {label}
        {required && <span className="ml-1 text-[#A96C63]">*</span>}
      </label>

      {children}

      {description && !error && (
        <p className="text-[11px] leading-4 text-[#858D84]">{description}</p>
      )}

      {error && <p className="text-[11px] leading-4 text-[#B45F58]">{error}</p>}
    </div>
  );
}
