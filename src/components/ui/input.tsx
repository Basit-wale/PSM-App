import * as React from "react";
import { cn } from "cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          type={type}
          aria-invalid={!!error || props["aria-invalid"]}
          className={cn(
            "h-9 w-full rounded-md border border-[#DEDFD7] bg-[#FBFAF7] px-3 text-[13px] text-[#343B35] outline-none transition-colors placeholder:text-[#9A9F96] focus:border-[#819584] focus:ring-2 focus:ring-[#819584]/15 disabled:cursor-not-allowed disabled:bg-[#EFEEE9] disabled:text-[#92998F]",
            error &&
              "border-[#C87870] focus:border-[#C87870] focus:ring-[#C87870]/15",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-[#B45F58]">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
