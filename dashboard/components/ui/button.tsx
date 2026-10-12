"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:shadow-sm active:scale-[0.98]",
        secondary:
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--neutral-100))] active:scale-[0.98]",
        ghost:
          "hover:bg-[hsl(var(--accent))] active:scale-[0.98]",
        outline:
          "border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--accent))] active:scale-[0.98]",
        destructive:
          "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90 active:scale-[0.98]",
        link: "text-[hsl(var(--primary))] underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-3 text-xs rounded-sm",
        sm: "h-8 px-3.5 text-sm rounded",
        md: "h-9 px-4.5 text-base rounded",
        lg: "h-11 px-6 text-lg rounded-lg",
        xl: "h-13 px-8 text-lg rounded-lg",
        icon: "h-9 w-9 md:h-10 md:w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));
    const isInteractive = variant !== "link" && variant !== "ghost";

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <motion.button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        whileHover={isInteractive ? { y: -1 } : {}}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };