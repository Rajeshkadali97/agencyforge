"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Home, Rocket, Library, Activity, Globe, Compass, Radar, CloudSun, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Go to" | "Launch a mission";
}

const ITEMS: PaletteItem[] = [
  { id: "home", label: "Headquarters", hint: "Team overview and live activity", href: "/", icon: Home, group: "Go to" },
  { id: "missions", label: "Missions", hint: "Give the team a goal", href: "/missions", icon: Rocket, group: "Go to" },
  { id: "apis", label: "API Explorer", hint: "Browse free public APIs", href: "/apis", icon: Library, group: "Go to" },
  { id: "team", label: "Team", hint: "Meet the agents and their moods", href: "/team", icon: Users, group: "Go to" },
  { id: "routing", label: "AI Routing", hint: "Provider chain and health", href: "/ai-routing", icon: Activity, group: "Go to" },
  { id: "websites", label: "Websites", hint: "AI-generated site projects", href: "/websites", icon: Globe, group: "Go to" },
  { id: "m-market", label: "Market brief", hint: "Research a market, country and tech trends", href: "/missions?template=market-brief", icon: Compass, group: "Launch a mission" },
  { id: "m-trend", label: "Trend radar", hint: "What the tech community is discussing", href: "/missions?template=trend-radar", icon: Radar, group: "Launch a mission" },
  { id: "m-launch", label: "Pop-up launch check", hint: "City conditions plus category research", href: "/missions?template=launch-weather", icon: CloudSun, group: "Launch a mission" },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q));
  }, [query]);

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  const go = React.useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-neutral-900/30 px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-label="Command palette"
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl backdrop-blur-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
              <Search className="h-5 w-5 text-neutral-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Go to a screen or launch a mission…"
                className="flex-1 bg-transparent text-[15px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              <kbd className="rounded-md border border-black/10 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">ESC</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-4 py-8 text-center text-sm font-medium text-neutral-400">No matches.</li>}
              {results.map((item, i) => {
                const Icon = item.icon;
                const showGroup = i === 0 || results[i - 1]?.group !== item.group;
                return (
                  <React.Fragment key={item.id}>
                    {showGroup && (
                      <li className="px-3 pb-1 pt-3 text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">{item.group}</li>
                    )}
                    <li>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(item)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                          i === active ? "bg-emerald-50" : "hover:bg-neutral-50",
                        )}
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-black/5">
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-extrabold text-neutral-900">{item.label}</span>
                          <span className="block truncate text-xs font-medium text-neutral-500">{item.hint}</span>
                        </span>
                      </button>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
