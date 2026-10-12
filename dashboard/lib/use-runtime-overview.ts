"use client";

import * as React from "react";
import { RUNTIME_ENDPOINTS } from "./runtime-config";
import { runtimeJson } from "./runtime-api";
import type { Mission, MissionTask } from "./missions";

export interface ActivityItem {
  id: string;
  agent: string;
  title: string;
  status: MissionTask["status"];
  at: string;
  missionGoal: string;
}

export interface OverviewStats {
  missions: number;
  completed: number;
  failed: number;
  running: number;
  tasksDone: number;
  successRate: number | null;
  sources: number;
}

export interface RuntimeOverview {
  online: boolean | null;
  missions: Mission[];
  stats: OverviewStats;
  activity: ActivityItem[];
  /** Latest task per department, used to show real status on department cards. */
  byAgent: Record<string, { status: MissionTask["status"]; title: string; summary?: string }>;
}

const EMPTY_STATS: OverviewStats = {
  missions: 0,
  completed: 0,
  failed: 0,
  running: 0,
  tasksDone: 0,
  successRate: null,
  sources: 0,
};

export function deriveOverview(missions: Mission[], online: boolean | null): RuntimeOverview {
  const finished = missions.filter((m) => m.status === "completed" || m.status === "failed");
  const completed = missions.filter((m) => m.status === "completed").length;
  const failed = missions.filter((m) => m.status === "failed").length;
  const running = missions.length - finished.length;
  const tasks = missions.flatMap((m) => m.tasks.map((t) => ({ t, m })));
  const tasksDone = tasks.filter(({ t }) => t.status === "done").length;
  const sources = new Set(tasks.map(({ t }) => t.sourceName).filter((s): s is string => Boolean(s))).size;

  const activity: ActivityItem[] = tasks
    .filter(({ t }) => t.status !== "pending")
    .map(({ t, m }) => ({
      id: `${m.id}-${t.id}`,
      agent: t.agent,
      title: t.title,
      status: t.status,
      at: (t as MissionTask & { endedAt?: string; startedAt?: string }).endedAt ?? (t as MissionTask & { startedAt?: string }).startedAt ?? m.createdAt,
      missionGoal: m.goal,
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  const byAgent: RuntimeOverview["byAgent"] = {};
  for (const item of [...activity].reverse()) {
    const task = tasks.find(({ t, m }) => `${m.id}-${t.id}` === item.id)?.t;
    byAgent[item.agent] = { status: item.status, title: item.title, summary: task?.summary };
  }

  return {
    online,
    missions,
    stats: {
      missions: missions.length,
      completed,
      failed,
      running,
      tasksDone,
      successRate: finished.length > 0 ? Math.round((completed / finished.length) * 100) : null,
      sources,
    },
    activity,
    byAgent,
  };
}

/** Polls the runtime for missions and derives dashboard statistics from real data. */
export function useRuntimeOverview(pollMs = 4000): RuntimeOverview {
  const [state, setState] = React.useState<{ online: boolean | null; missions: Mission[] }>({
    online: null,
    missions: [],
  });

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await runtimeJson<{ missions: Mission[] }>(RUNTIME_ENDPOINTS.missions);
        if (alive) setState({ online: true, missions: res.missions });
      } catch {
        if (alive) setState((s) => ({ ...s, online: false }));
      }
    };
    void load();
    const timer = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pollMs]);

  return React.useMemo(() => deriveOverview(state.missions, state.online), [state]);
}

export { EMPTY_STATS };
