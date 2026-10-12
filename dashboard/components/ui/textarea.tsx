import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base transition-colors duration-150 ease-out",
          "placeholder:text-[hsl(var(--neutral-400))]",
          "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-y",
          error
            ? "border-[hsl(var(--error))] focus:ring-[hsl(var(--error))]"
            : "border-[hsl(var(--input))]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };