import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25 rounded-xl",
        theme: "bg-theme-primary text-white hover:bg-theme-primary-hover hover:shadow-lg hover:shadow-[#008374]/25 rounded-xl",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/25 rounded-xl",
        success:
          "bg-success text-success-foreground hover:bg-success/90 hover:shadow-lg hover:shadow-success/25 rounded-xl",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 hover:shadow-lg hover:shadow-warning/25 rounded-xl",
        info:
          "bg-info text-info-foreground hover:bg-info/90 hover:shadow-lg hover:shadow-info/25 rounded-xl",
        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50 rounded-xl",
        "outline-theme":
          "border-2 border-[#008374] bg-transparent text-[#008374] hover:bg-[#008374] hover:text-white hover:shadow-lg hover:shadow-[#008374]/25 rounded-xl",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover hover:shadow-lg rounded-xl",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-xl",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-white/70 backdrop-blur-md border border-white/50 text-foreground hover:bg-white/90 hover:shadow-lg rounded-xl",
        "glass-primary": "bg-[#008374]/90 backdrop-blur-md border border-[#008374]/50 text-white hover:bg-[#008374] hover:shadow-lg hover:shadow-[#008374]/25 rounded-xl",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
