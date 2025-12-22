import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover rounded-lg",
        theme: "bg-theme-primary text-white hover:bg-theme-primary-hover rounded-lg",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg",
        success:
          "bg-success text-success-foreground hover:bg-success/90 rounded-lg",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 rounded-lg",
        info:
          "bg-info text-info-foreground hover:bg-info/90 rounded-lg",
        outline:
          "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg",
        "outline-theme":
          "border-2 border-theme-primary bg-transparent text-theme-primary hover:bg-theme-primary hover:text-white rounded-lg",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover rounded-lg",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-lg",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg",
        icon: "h-10 w-10",
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
