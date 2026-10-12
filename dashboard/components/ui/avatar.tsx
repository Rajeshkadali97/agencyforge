"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getInitials } from "@/lib/utils";

const avatarVariants = cva("relative inline-flex items-center justify-center overflow-hidden rounded-full font-medium select-none flex-shrink-0", {
  variants: {
    size: {
      xs: "h-6 w-6 text-[10px]",
      sm: "h-8 w-8 text-xs",
      md: "h-10 w-10 text-sm",
      lg: "h-12 w-12 text-base",
      xl: "h-16 w-16 text-xl",
      "2xl": "h-20 w-20 text-2xl",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const avatarImageVariants = "aspect-square h-full w-full object-cover";

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
  status?: "online" | "away" | "busy" | "offline";
}

const statusColors = {
  online: "bg-[hsl(var(--success))]",
  away: "bg-[hsl(var(--warning))]",
  busy: "bg-[hsl(var(--error))]",
  offline: "bg-[hsl(var(--neutral-300))]",
};

const statusSizes = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-3.5 w-3.5",
  "2xl": "h-4 w-4",
};

const avatarColors = [
  { bg: "#E8F5E9", text: "#1D1D1F" },
  { bg: "#E3F2FD", text: "#1D1D1F" },
  { bg: "#F3E5F5", text: "#1D1D1F" },
  { bg: "#FFF3E0", text: "#1D1D1F" },
  { bg: "#E0F7FA", text: "#1D1D1F" },
  { bg: "#FCE4EC", text: "#1D1D1F" },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt, fallback, status, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false);
    const showImage = src && !imageError;
    const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";
    const avatarStyle = getAvatarStyle(alt || fallback || initials);

    return (
      <div ref={ref} className={cn(avatarVariants({ size }), className)} {...props}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={avatarImageVariants}
            src={src}
            alt={alt || fallback || "Avatar"}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}
          >
            {initials}
          </div>
        )}
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 rounded-full border-2 border-[hsl(var(--card))]",
              statusColors[status],
              statusSizes[size || "md"]
            )}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, avatarVariants };