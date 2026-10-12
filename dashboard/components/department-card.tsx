"use client";


import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Search,
  Megaphone,
  TrendingUp,
  Cog,
  Globe,
  Palette,
  FileText,
  Film,
  BarChart3,
  Bot,
} from "lucide-react";
import type { AgentState } from "@/lib/events";
import type { DepartmentId } from "@/components/characters/core/types";
import { CharacterRenderer } from "@/components/character";

const departmentIcons: Record<DepartmentId, React.ComponentType<{ className?: string }>> = {
  ceo: Bot,
  research: Search,
  marketing: Megaphone,
  sales: TrendingUp,
  automation: Cog,
  website: Globe,
  creative: Palette,
  content: FileText,
  motion: Film,
  seo: Search,
  analytics: BarChart3,
};

const departmentLabels: Record<DepartmentId, string> = {
  ceo: "CEO",
  research: "Research",
  marketing: "Marketing",
  sales: "Sales",
  automation: "Automation",
  website: "Web Dev",
  creative: "Creative",
  content: "Content",
  motion: "Motion",
  seo: "SEO",
  analytics: "Analytics",
};

const departmentStatusConfig: Record<
  DepartmentId,
  { label: string; color: string; bgColor: string; iconBg: string }
> = {
  ceo:        { label: "Active",     color: "text-emerald-600", bgColor: "bg-emerald-50",   iconBg: "from-emerald-100 to-teal-100" },
  research:   { label: "Analyzing",  color: "text-blue-600",   bgColor: "bg-blue-50",      iconBg: "from-blue-100 to-indigo-100" },
  marketing:  { label: "Planning",   color: "text-emerald-600",bgColor: "bg-emerald-50",   iconBg: "from-emerald-100 to-teal-100" },
  sales:      { label: "Engaging",   color: "text-amber-600",  bgColor: "bg-amber-50",     iconBg: "from-amber-100 to-orange-100" },
  automation: { label: "Automating", color: "text-violet-600", bgColor: "bg-violet-50",    iconBg: "from-violet-100 to-emerald-100" },
  website:    { label: "Building",   color: "text-sky-600",    bgColor: "bg-sky-50",       iconBg: "from-sky-100 to-blue-100" },
  creative:   { label: "Designing",  color: "text-fuchsia-600",bgColor: "bg-fuchsia-50",   iconBg: "from-fuchsia-100 to-pink-100" },
  content:    { label: "Writing",    color: "text-orange-600", bgColor: "bg-orange-50",    iconBg: "from-orange-100 to-amber-100" },
  motion:     { label: "Animating",  color: "text-rose-600",   bgColor: "bg-rose-50",      iconBg: "from-rose-100 to-pink-100" },
  seo:        { label: "Optimizing", color: "text-teal-600",   bgColor: "bg-teal-50",      iconBg: "from-teal-100 to-emerald-100" },
  analytics:  { label: "Tracking",   color: "text-indigo-600", bgColor: "bg-indigo-50",    iconBg: "from-indigo-100 to-blue-100" },
};

interface DepartmentCardProps {
  agent: AgentState;
  onClick?: () => void;
  onExpand?: (department: DepartmentId) => void;
  isExpanded?: boolean;
  className?: string;
}

function DepartmentCard({
  agent,
  onClick,
  onExpand,
  isExpanded = false,
  className,
}: DepartmentCardProps) {
  const department = agent.department;
  const statusInfo =
    agent.status === "busy"
      ? { label: "Working", color: "text-sky-600", bgColor: "bg-sky-50", iconBg: "from-sky-100 to-blue-100" }
      : agent.status === "thinking"
        ? { label: "Thinking", color: "text-violet-600", bgColor: "bg-violet-50", iconBg: "from-violet-100 to-indigo-100" }
        : agent.status === "speaking"
          ? { label: "Reporting", color: "text-emerald-600", bgColor: "bg-emerald-50", iconBg: "from-emerald-100 to-teal-100" }
          : agent.status === "error"
            ? { label: "Needs attention", color: "text-rose-600", bgColor: "bg-rose-50", iconBg: "from-rose-100 to-pink-100" }
            : { label: "Ready", color: "text-emerald-600", bgColor: "bg-emerald-50", iconBg: departmentStatusConfig[department]?.iconBg ?? "from-slate-100 to-gray-100" };

  const emotion = agent.status === "thinking" ? "thinking" : agent.status === "busy" ? "working" : agent.status === "speaking" ? "speaking" : agent.status === "error" ? "error" : "idle";

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "dept-card group relative flex flex-col w-full h-full p-3.5 rounded-[24px] text-left select-none cursor-pointer overflow-hidden",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* ── Top Character Image Container (rounded-2xl) ── */}
      <div className="relative w-full aspect-[1.1] rounded-2xl overflow-hidden bg-slate-50 border border-black/5 mb-3.5 char-img-container">
        <CharacterRenderer
          department={department}
          emotion={emotion}
          size="xl"
          className="h-full w-full rounded-none border-0 bg-transparent shadow-none"
          imageClassName="transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Floating chevron at top right */}
      <div className="absolute top-5 right-5 p-1.5 rounded-full bg-white/70 border border-black/5 text-neutral-600 backdrop-blur-md group-hover:text-emerald-600 group-hover:bg-white transition-all shadow-sm">
        <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>

      {/* Bottom: Department Info */}
      <div className="space-y-1.5 mt-auto">
        <h3 className="font-bold text-neutral-800 text-[14px] tracking-tight leading-tight group-hover:text-emerald-600 transition-colors">
          {departmentLabels[department]}
        </h3>

        <div className="flex flex-col gap-1">
          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className={cn("status-dot status-dot-active", statusInfo.color)} style={{ color: "currentColor", backgroundColor: "currentColor" }} />
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", statusInfo.color)}>
              {statusInfo.label}
            </span>
          </div>

          {/* Metric / Message */}
          <p className="text-[11px] text-neutral-500 font-medium truncate max-w-[180px]">
            {agent.message}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

export { DepartmentCard };
export type { DepartmentCardProps };
