import * as React from "react";
import { cn } from "cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          aria-invalid={!!error || props["aria-invalid"]}
          className={cn(
            "min-h-24 w-full rounded-md border border-[#DEDFD7] bg-[#FBFAF7] px-3 py-2.5 text-[13px] leading-5 text-[#343B35] outline-none transition-colors placeholder:text-[#9A9F96] focus:border-[#819584] focus:ring-2 focus:ring-[#819584]/15 disabled:cursor-not-allowed disabled:bg-[#EFEEE9] disabled:text-[#92998F]",
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

Textarea.displayName = "Textarea";

export { Textarea };
