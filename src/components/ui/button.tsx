import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border text-[13px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#91A493] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-[#617968] bg-[#617968] text-white shadow-sm hover:border-[#526957] hover:bg-[#526957]",
        outline:
          "border-[#D9DED7] bg-[#FBFAF7] text-[#465047] hover:border-[#C5CEC4] hover:bg-[#F0F2ED]",
        secondary:
          "border-[#E1E6DF] bg-[#E9EEE8] text-[#526957] hover:border-[#D2DCD1] hover:bg-[#DFE7DE]",
        ghost:
          "border-transparent bg-transparent text-[#626B63] hover:bg-[#ECEFE9] hover:text-[#39483D]",
        destructive:
          "border-[#D9A5A1] bg-[#B95F59] text-white hover:border-[#AD514B] hover:bg-[#A94F49]",
        link: "border-transparent bg-transparent text-[#617968] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs: "h-7 px-2 text-xs",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5 text-sm",
        icon: "size-9",
        "icon-xs": "size-7",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
