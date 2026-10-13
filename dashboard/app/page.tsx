"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Rocket,
  Search,
  ChevronRight,
  Library,
  Activity,
  Globe,
  CheckCircle2,
  Circle,
  Clock,
  Command,
  Wrench,
} from "lucide-react";
import { AgentShell } from "@/components/shell";
import { DepartmentCard } from "@/components/department-card";
import { CharacterRenderer } from "@/components/character";
import { CommandPalette } from "@/components/command-palette";
import { Surface } from "@/components/page-header";
import { useAllAgents } from "@/lib/store-context";
import { useRuntimeOverview, type RuntimeOverview } from "@/lib/use-runtime-overview";
import type { DepartmentId } from "@/components/characters/core/types";
import type { AgentState } from "@/lib/events";
import { cn } from "@/lib/utils";

const DEPARTMENTS: Exclude<DepartmentId, "ceo">[] = [
  "research",
  "marketing",
  "analytics",
  "content",
  "sales",
  "website",
  "creative",
  "seo",
  "motion",
  "automation",
];

/** Tools that are wired to live data today. Departments without one are marked as such. */
const DEPARTMENT_TOOLS: Partial<Record<DepartmentId, Array<{ name: string; detail: string; url: string }>>> = {
  research: [{ name: "Wikipedia", detail: "Background research and topic summaries", url: "https://en.wikipedia.org/" }],
  analytics: [{ name: "Open-Meteo", detail: "Live weather and conditions for any city", url: "https://open-meteo.com/" }],
  marketing: [{ name: "World Bank", detail: "Country population, income and GDP per capita", url: "https://data.worldbank.org/" }],
  content: [{ name: "Hacker News", detail: "Live tech-community trend scan", url: "https://news.ycombinator.com/" }],
  website: [{ name: "Website builder", detail: "Brief → site plan → generated pages", url: "/websites" }],
};

const AGENT_LABEL: Record<string, string> = {
  research: "Research Agent",
  analytics: "Analytics Expert",
  marketing: "Marketing Agent",
  content: "Content Strategist",
  ceo: "CEO",
};

function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function withLiveStatus(agent: AgentState, live: RuntimeOverview["byAgent"][string] | undefined): AgentState {
  if (!live) return agent;
  const status = live.status === "running" ? "busy" : live.status === "failed" ? "error" : "idle";
  const message = live.status === "done" && live.summary ? live.summary : live.title;
  return { ...agent, status, message };
}

/* ── Department workspace ──────────────────────────────────────────────────── */

function DepartmentWorkspace({
  department,
  agent,
  overview,
  onBack,
}: {
  department: Exclude<DepartmentId, "ceo">;
  agent: AgentState | undefined;
  overview: RuntimeOverview;
  onBack: () => void;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const tools = DEPARTMENT_TOOLS[department] ?? [];
  const work = overview.activity.filter((a) => a.agent === department);
  const live = overview.byAgent[department];
  const emotion = live?.status === "running" ? "working" : live?.status === "failed" ? "worried" : live?.status === "done" ? "happy" : "idle";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 14 }}
      className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-neutral-400 transition hover:text-neutral-700"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Back to Headquarters
      </button>

      <div className="flex flex-wrap items-center gap-6">
        <CharacterRenderer department={department} emotion={emotion} size="hero" />
        <div>
          <h1 className="text-3xl font-extrabold capitalize tracking-tight text-neutral-900">{department} department</h1>
          <p className="mt-1 text-[15px] font-medium text-neutral-500">{agent?.title ?? "Department lead"}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-neutral-600 ring-1 ring-black/5">
            <span className={cn("h-2 w-2 rounded-full", live?.status === "running" ? "animate-pulse bg-sky-500" : "bg-emerald-500")} />
            {live?.status === "running" ? "Working on a task" : "Ready for missions"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <Surface className="p-6 md:col-span-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-400">Recent work</h2>
          {work.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-neutral-400">
              No work yet. <Link href="/missions" className="font-bold text-emerald-700 hover:underline">Launch a mission</Link> and this team will show up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {work.map((item) => (
                <li key={item.id} className="rounded-2xl border border-black/5 bg-white/70 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-neutral-800">{item.title}</p>
                    <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-neutral-400">
                      <Clock className="h-3 w-3" /> {timeAgo(item.at, now)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-neutral-500">Mission: {item.missionGoal}</p>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="p-6 md:col-span-2">
          <h2 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-neutral-400">
            <Wrench className="h-3.5 w-3.5" /> Tools
          </h2>
          {tools.length === 0 ? (
            <p className="mt-4 text-sm font-medium leading-relaxed text-neutral-500">
              No live tool is wired to this department yet. Browse the{" "}
              <Link href="/apis" className="font-bold text-emerald-700 hover:underline">API Explorer</Link> for free APIs
              it could use.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {tools.map((tool) => (
                <li key={tool.name} className="rounded-2xl border border-black/5 bg-white/70 p-3.5">
                  <p className="text-sm font-extrabold text-neutral-800">{tool.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-neutral-500">{tool.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </motion.div>
  );
}

/* ── Headquarters ──────────────────────────────────────────────────────────── */

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
      <p className="text-2xl font-extrabold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-0.5 text-xs font-bold text-neutral-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] font-medium text-neutral-400">{hint}</p>}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const agents = useAllAgents();
  const overview = useRuntimeOverview();
  const [selected, setSelected] = React.useState<Exclude<DepartmentId, "ceo"> | null>(null);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [goal, setGoal] = React.useState("");
  const [hello, setHello] = React.useState("Welcome back");
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    setHello(greeting(new Date()));
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { stats, online } = overview;
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "Operator";

  const bubble =
    online === false
      ? "The runtime is offline. Start it with `pnpm start:runtime`, then refresh this page."
      : stats.running > 0
        ? `${stats.running} mission${stats.running === 1 ? " is" : "s are"} in progress. Your team is on it.`
        : stats.missions === 0
          ? "Your team is online and ready. Give them a goal and watch the plan, hand-offs and result. No API keys needed."
          : `${stats.missions} mission${stats.missions === 1 ? "" : "s"} run, ${stats.tasksDone} task${stats.tasksDone === 1 ? "" : "s"} done${
              stats.successRate !== null ? `, ${stats.successRate}% success` : ""
            }. Ready for the next goal.`;

  const ceoEmotion = online === false ? "worried" : stats.running > 0 ? "working" : "happy";

  const submitGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const text = goal.trim();
    if (text.length < 3) return;
    router.push(`/missions?goal=${encodeURIComponent(text)}&run=1`);
  };

  const selectedAgent = selected ? agents.find((a) => a.department === selected) : undefined;

  const checklist = [
    { done: stats.missions > 0, label: "Launch your first mission", href: "/missions", icon: Rocket },
    { done: false, label: "Browse 700+ free, key-less APIs", href: "/apis", icon: Library },
    { done: false, label: "Check the AI provider chain", href: "/ai-routing", icon: Activity },
    { done: false, label: "Generate a website", href: "/websites/new", icon: Globe },
  ];

  return (
    <AgentShell
      selectedDepartment={selected ?? "ceo"}
      onDepartmentSelect={(d) => setSelected(d === "ceo" ? null : (d as Exclude<DepartmentId, "ceo">))}
    >
      <AnimatePresence mode="wait">
        {selected === null ? (
          <motion.div
            key="hq"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-[1500px] space-y-7 p-6 lg:p-8"
          >
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-[32px] font-extrabold tracking-tight text-neutral-900" suppressHydrationWarning>
                  {hello}, {operator}
                </h1>
                <p className="mt-1 text-[15px] font-medium text-neutral-500">Your AI agency at a glance.</p>
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-2.5 text-sm font-medium text-neutral-400 shadow-sm transition hover:bg-white"
              >
                <Search className="h-4 w-4" />
                Search or jump to…
                <span className="flex items-center gap-0.5 rounded-md border border-black/10 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">
                  <Command className="h-3 w-3" />K
                </span>
              </button>
            </header>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-7">
                {/* hero */}
                <Surface className="p-6">
                  <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
                    <CharacterRenderer department="ceo" emotion={ceoEmotion} size="hero" className="flex-shrink-0" />
                    <div className="w-full flex-1 space-y-4">
                      <div className="speech-bubble max-w-[620px] p-5">
                        <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">Your AI HQ</p>
                        <p className="text-[15px] font-medium leading-relaxed text-neutral-700">{bubble}</p>
                      </div>
                      <form onSubmit={submitGoal} className="flex max-w-[620px] items-center gap-2">
                        <input
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          maxLength={500}
                          placeholder="Give your team a goal…"
                          aria-label="Mission goal"
                          className="flex-1 rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-[15px] font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                        <button
                          type="submit"
                          disabled={goal.trim().length < 3}
                          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
                        >
                          Launch <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["Market brief", "market-brief"],
                          ["Trend radar", "trend-radar"],
                          ["Pop-up launch check", "launch-weather"],
                        ].map(([label, id]) => (
                          <Link
                            key={id}
                            href={`/missions?template=${id}`}
                            className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </Surface>

                {/* departments */}
                <section aria-label="Departments">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <h2 className="text-[20px] font-extrabold tracking-tight text-neutral-900">Your AI departments</h2>
                      <p className="mt-0.5 text-[13px] font-medium text-neutral-500">Click a department to see its tools and recent work.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                    {DEPARTMENTS.map((dept) => {
                      const agent = agents.find((a) => a.department === dept);
                      if (!agent) return null;
                      return (
                        <DepartmentCard
                          key={dept}
                          agent={withLiveStatus(agent, overview.byAgent[dept])}
                          onClick={() => setSelected(dept)}
                        />
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* right rail */}
              <aside aria-label="Mission control and activity" className="space-y-5">
                <Surface className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-extrabold text-neutral-900">Mission control</h2>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        online === false ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", online === false ? "bg-rose-500" : "bg-emerald-500")} />
                      {online === false ? "Runtime offline" : online ? "Runtime online" : "Connecting…"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Metric label="Missions run" value={String(stats.missions)} />
                    <Metric label="Tasks done" value={String(stats.tasksDone)} />
                    <Metric label="Success rate" value={stats.successRate === null ? "–" : `${stats.successRate}%`} />
                    <Metric label="Live sources" value={String(stats.sources)} hint="distinct APIs used" />
                  </div>
                </Surface>

                <Surface className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[15px] font-extrabold text-neutral-900">Recent activity</h2>
                    <Link href="/missions" className="text-xs font-bold text-emerald-700 hover:underline">
                      Open missions
                    </Link>
                  </div>
                  {overview.activity.length === 0 ? (
                    <p className="py-4 text-center text-sm font-medium text-neutral-400">
                      Nothing yet. Launch a mission to see your team work.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {overview.activity.map((item) => (
                        <li key={item.id} className="flex items-start gap-3">
                          <CharacterRenderer
                            department={item.agent}
                            emotion={item.status === "running" ? "working" : item.status === "failed" ? "worried" : "happy"}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold leading-snug text-neutral-800">
                              {AGENT_LABEL[item.agent] ?? item.agent}{" "}
                              <span className="font-medium text-neutral-500">
                                {item.status === "done" ? "finished" : item.status === "failed" ? "hit a problem on" : "is working on"}
                              </span>{" "}
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-[11px] font-semibold text-neutral-400">{timeAgo(item.at, now)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Surface>

                <Surface className="space-y-3 p-5">
                  <h2 className="text-[15px] font-extrabold text-neutral-900">Getting started</h2>
                  <ul className="space-y-1.5">
                    {checklist.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.label}>
                          <Link
                            href={item.href}
                            className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/80"
                          >
                            {item.done ? (
                              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                            ) : (
                              <Circle className="h-5 w-5 flex-shrink-0 text-neutral-300" />
                            )}
                            <span className={cn("flex-1 text-[13px] font-bold", item.done ? "text-neutral-400 line-through" : "text-neutral-700")}>
                              {item.label}
                            </span>
                            <Icon className="h-4 w-4 text-neutral-300 transition group-hover:text-emerald-600" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </Surface>
              </aside>
            </div>
          </motion.div>
        ) : (
          <DepartmentWorkspace
            key={selected}
            department={selected}
            agent={selectedAgent}
            overview={overview}
            onBack={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </AgentShell>
  );
}
