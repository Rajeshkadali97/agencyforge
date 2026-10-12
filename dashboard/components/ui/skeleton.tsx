import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer bg-gradient-to-r from-[hsl(var(--neutral-100))] via-[hsl(var(--neutral-50))] to-[hsl(var(--neutral-100))] bg-[length:200%_100%] dark:from-[hsl(var(--neutral-100))] dark:via-[hsl(var(--neutral-200))] dark:to-[hsl(var(--neutral-100))]",
        variant === "text" && "rounded-sm h-4",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={{
        width,
        height: height || (variant === "circular" ? width : undefined),
        ...style,
      }}
      {...props}
    />
  );
}

export { Skeleton };