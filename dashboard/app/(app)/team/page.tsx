"use client";

import * as React from "react";
import { Users } from "lucide-react";
import { CharacterRenderer } from "@/components/character";
import { PageHeader, Surface } from "@/components/page-header";
import { cn } from "@/lib/utils";

interface Member {
  department: string;
  name: string;
  title: string;
  tool?: string;
}

const MEMBERS: Member[] = [
  { department: "ceo", name: "CEO", title: "Writes the executive brief", tool: "LLM or template writer" },
  { department: "research", name: "Research Agent", title: "Background research", tool: "Wikipedia" },
  { department: "analytics", name: "Analytics Expert", title: "Live conditions and data", tool: "Open-Meteo" },
  { department: "marketing", name: "Marketing Agent", title: "Market profiles", tool: "World Bank" },
  { department: "content", name: "Content Strategist", title: "Trend scanning", tool: "Hacker News" },
  { department: "sales", name: "Sales Agent", title: "Pipeline and outreach (preview)" },
  { department: "website", name: "Web Architect", title: "Site plans and pages", tool: "Website builder" },
  { department: "creative", name: "Creative Director", title: "Brand and design direction" },
  { department: "seo", name: "SEO Specialist", title: "Search analysis (preview)" },
  { department: "motion", name: "Motion Designer", title: "Video and animation (preview)" },
  { department: "automation", name: "Automation Agent", title: "Workflows and integrations (preview)" },
];

const MOODS = ["idle", "thinking", "working", "speaking", "listening", "happy", "celebrating", "worried", "error", "sleeping"] as const;

export default function TeamPage() {
  const [department, setDepartment] = React.useState("research");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Team"
        subtitle="The agents behind every mission, and how they look when they work"
      />

      <section aria-label="Agents">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {MEMBERS.map((m) => (
            <li key={m.department}>
              <Surface className="flex h-full flex-col items-center gap-3 p-5 text-center">
                <CharacterRenderer department={m.department} emotion="idle" size="xl" />
                <div>
                  <h2 className="text-[15px] font-extrabold text-neutral-900">{m.name}</h2>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-neutral-500">{m.title}</p>
                </div>
                {m.tool ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                    {m.tool}
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
                    No live tool yet
                  </span>
                )}
              </Surface>
            </li>
          ))}
        </ul>
      </section>

      <Surface className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold text-neutral-900">Moods</h2>
            <p className="text-xs font-medium text-neutral-500">Avatars react to what the agent is doing in a mission.</p>
          </div>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Agent"
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-neutral-700 outline-none focus:border-emerald-400"
          >
            {MEMBERS.map((m) => (
              <option key={m.department} value={m.department}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {MOODS.map((mood) => (
            <li key={mood} className="flex flex-col items-center gap-2">
              <CharacterRenderer department={department} emotion={mood} size="xl" />
              <span className={cn("text-xs font-bold capitalize text-neutral-600")}>{mood}</span>
            </li>
          ))}
        </ul>
      </Surface>
    </div>
  );
}
