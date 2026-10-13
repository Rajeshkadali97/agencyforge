"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutGrid,
  Rocket,
  Library,
  Users,
  Activity,
  Globe,
  ChevronRight,
  Sparkles,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentId } from "@/components/characters/core/types";
import { CharacterFace } from "./character";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  action?: () => void;
}

interface SidebarProps {
  selectedDepartment?: DepartmentId;
  onDepartmentSelect?: (department: DepartmentId) => void;
  collapsed?: boolean;
  className?: string;
}

function Sidebar({
  selectedDepartment = "ceo",
  onDepartmentSelect,
  collapsed = false,
  className,
}: SidebarProps) {
  const router = useRouter();
  const [focusMode, setFocusMode] = React.useState(true);

  const pathname = usePathname() ?? "/";
  const onHq = pathname === "/";

  const mainNavItems: NavItem[] = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      action: () => (onHq ? onDepartmentSelect?.("ceo") : router.push("/")),
    },
    {
      id: "departments",
      label: "Departments",
      icon: LayoutGrid,
      action: () => (onHq ? onDepartmentSelect?.("research") : router.push("/")),
    },
    { id: "missions", label: "Missions", icon: Rocket, action: () => router.push("/missions") },
    { id: "apis", label: "API Explorer", icon: Library, action: () => router.push("/apis") },
    { id: "team", label: "Team", icon: Users, action: () => router.push("/team") },
    { id: "routing", label: "AI Routing", icon: Activity, action: () => router.push("/ai-routing") },
    { id: "websites", label: "Websites", icon: Globe, action: () => router.push("/websites") },
  ];

  const isHomeActive = onHq && selectedDepartment === "ceo";
  const activeIdByPath = (id: string): boolean => {
    if (id === "home") return isHomeActive;
    if (id === "departments") return onHq && !isHomeActive;
    if (id === "missions") return pathname.startsWith("/missions");
    if (id === "apis") return pathname.startsWith("/apis");
    if (id === "team") return pathname.startsWith("/team");
    if (id === "routing") return pathname.startsWith("/ai-routing");
    if (id === "websites") return pathname.startsWith("/websites");
    return false;
  };

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "flex flex-col h-[calc(100vh-32px)] my-4 ml-4 rounded-[28px] transition-all duration-300 relative z-20 glass-panel border border-white/50",
        collapsed ? "w-[76px]" : "w-[250px]",
        className
      )}
      style={{
        background: "rgba(255, 255, 255, 0.4)",
        backdropFilter: "blur(40px) saturate(180%)",
      }}
    >
      {/* ── Brand Logo ── */}
      <div className="flex items-center h-[72px] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/15">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-extrabold text-neutral-800 text-[18px] tracking-tight">
              AgencyForge
            </span>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeIdByPath(item.id);

            return (
              <button
                key={item.id}
                onClick={item.action || (() => {})}
                className={cn(
                  "sidebar-nav-item w-full",
                  isActive && "active"
                )}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="flex h-5 min-w-[22px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom Section ── */}
      <div className="p-3 space-y-3">
        {/* Profile Card */}
        <div
          className={cn(
            "flex items-center gap-3 p-2.5 rounded-2xl bg-white/40 border border-white/60 cursor-pointer hover:bg-white/70 transition-all",
            collapsed && "justify-center"
          )}
        >
          <div className="relative flex-shrink-0">
            <CharacterFace
              department="ceo"
              emotion="idle"
              size="sm"
              className="h-10 w-10 rounded-full border border-black/5"
            />
            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-neutral-800 truncate">
                {process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "Operator"}
              </p>
              <p className="text-[11px] text-neutral-500 font-medium">CEO Mode</p>
            </div>
          )}
          {!collapsed && (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          )}
        </div>

        {/* Focus Mode */}
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-white/60">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-[12px] font-semibold text-neutral-800 leading-none">Focus Mode</p>
                <p className="text-[10px] text-neutral-500 mt-0.5">
                  {focusMode ? "Active" : "Off"}
                  <span className="mx-1">•</span>
                  {focusMode ? "Do not disturb" : "Standard"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={focusMode}
              aria-label="Focus mode"
              onClick={() => setFocusMode(!focusMode)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2",
                focusMode ? "bg-emerald-500" : "bg-neutral-200"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 shadow-sm",
                  focusMode ? "translate-x-4.5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export { Sidebar };