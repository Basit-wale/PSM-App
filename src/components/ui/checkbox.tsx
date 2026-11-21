import * as React from "react";
import { cn } from "cn";

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[#D5DAD2] accent-[#718575] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#819584]/30 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
