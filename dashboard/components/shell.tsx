"use client";

import * as React from "react";
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

function AgentShell({
  children,
  selectedDepartment = "ceo",
  onDepartmentSelect,
  sidebarCollapsed = false,
  className,
}: AgentShellProps) {
  return (
    <div className={cn("relative flex h-screen overflow-hidden select-none bg-mesh", className)}>
      <div className="bg-mesh-orb-1" />
      <div className="bg-mesh-orb-2" />
      <Sidebar
        selectedDepartment={selectedDepartment}
        onDepartmentSelect={onDepartmentSelect}
        collapsed={sidebarCollapsed}
      />
      <main className="relative flex-1 overflow-hidden z-10">
        <div className="h-full overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export { AgentShell };