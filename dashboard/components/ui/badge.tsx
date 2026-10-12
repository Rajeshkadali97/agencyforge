import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm font-medium transition-colors duration-150 ease-out",
  {
    variants: {
      variant: {
        default: "bg-[hsl(var(--neutral-100))] text-[hsl(var(--neutral-700))]",
        primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
        secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
        success: "bg-[hsl(var(--success-muted))] text-[hsl(var(--success))]",
        warning: "bg-[hsl(var(--warning-muted))] text-[hsl(var(--warning))]",
        error: "bg-[hsl(var(--error-muted))] text-[hsl(var(--error))]",
        info: "bg-[hsl(var(--info-muted))] text-[hsl(var(--info))]",
        outline: "border border-[hsl(var(--border))] text-[hsl(var(--foreground))]",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };