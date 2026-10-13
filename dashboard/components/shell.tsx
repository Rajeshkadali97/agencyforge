"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import type { DepartmentId } from "@/components/characters/core/types";

interface AgentShellProps {
  children: React.ReactNode;
  selectedDepartment?: DepartmentId;
  onDepartmentSelect?: (department: DepartmentId) => void;
  sidebarCollapsed?: boolean;
  className?: string;
}

/**
 * Application chrome. From the `lg` breakpoint up the sidebar is always visible.
 * Below it the sidebar becomes a slide-in drawer opened from a top bar, so the
 * content gets the full phone width.
 */
function AgentShell({
  children,
  selectedDepartment = "ceo",
  onDepartmentSelect,
  sidebarCollapsed = false,
  className,
}: AgentShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close the drawer after navigating.
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const handleDepartmentSelect = React.useCallback(
    (department: DepartmentId) => {
      setDrawerOpen(false);
      onDepartmentSelect?.(department);
    },
    [onDepartmentSelect],
  );

  return (
    <div className={cn("relative flex h-screen overflow-hidden select-none bg-mesh", className)}>
      <div className="bg-mesh-orb-1" />
      <div className="bg-mesh-orb-2" />

      {/* desktop sidebar */}
      <div className="relative z-20 hidden lg:block">
        <Sidebar
          selectedDepartment={selectedDepartment}
          onDepartmentSelect={handleDepartmentSelect}
          collapsed={sidebarCollapsed}
        />
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar
              selectedDepartment={selectedDepartment}
              onDepartmentSelect={handleDepartmentSelect}
              className="!my-3 !ml-3 !h-[calc(100vh-24px)] shadow-2xl"
            />
          </div>
        </div>
      )}

      <main className="relative z-10 min-w-0 flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          {/* mobile top bar */}
          <div className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/50 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-[16px] font-extrabold tracking-tight text-neutral-800">AgencyForge</span>
            </div>
            <button
              type="button"
              aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((o) => !o)}
              className="rounded-xl border border-white/70 bg-white/70 p-2 text-neutral-700 shadow-sm"
            >
              {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}

export { AgentShell };
