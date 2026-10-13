/** Shapes returned by the runtime mission and API-catalog endpoints. */

export type StageStatus = "pending" | "running" | "done" | "failed";
export type TaskStatus = "pending" | "running" | "done" | "failed";
export type MissionStatus = "planning" | "assigning" | "executing" | "responding" | "completed" | "failed";

export interface MissionStage {
  name: "plan" | "assign" | "execute" | "respond";
  label: string;
  status: StageStatus;
  detail?: string;
}

export interface MissionTask {
  id: string;
  title: string;
  agent: string;
  tool: string;
  status: TaskStatus;
  durationMs?: number;
  summary?: string;
  error?: string;
  sourceName?: string;
  sourceUrl?: string;
}

export interface MissionResult {
  headline: string;
  summary: string;
  sections: Array<{ title: string; body: string; agent: string }>;
  sources: Array<{ name: string; url: string }>;
  writtenBy: "llm" | "template";
  provider?: string;
  model?: string;
}

export interface SuggestedApi {
  name: string;
  description: string;
  category: string;
  url: string;
  auth: string;
}

export interface Mission {
  id: string;
  goal: string;
  status: MissionStatus;
  plannedBy?: "rules" | "llm";
  createdAt: string;
  stages: MissionStage[];
  tasks: MissionTask[];
  suggestedApis: SuggestedApi[];
  result?: MissionResult;
  error?: string;
}

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  goal: string;
  agents: string[];
}

export interface CatalogApi {
  featured?: boolean;
  name: string;
  description: string;
  category: string;
  auth: string;
  https: boolean;
  cors: string;
  url: string;
}

export interface CatalogPage {
  total: number;
  items: CatalogApi[];
  limit: number;
  offset: number;
}

export const isFinished = (m: Mission): boolean => m.status === "completed" || m.status === "failed";
