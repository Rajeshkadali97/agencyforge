import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent header used by every non-HQ screen. */
export function PageHeader({ icon, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[14px] font-medium text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Frosted card surface shared by new screens. */
export function Surface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/70 bg-white/55 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
