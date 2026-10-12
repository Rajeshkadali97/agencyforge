/**
 * Mission pipeline types.
 *
 * A mission turns a plain-language goal into a visible four-stage pipeline:
 *   plan -> assign -> execute -> respond
 * Every intermediate result is stored on the mission, so clients can inspect
 * the plan, the tool chosen for each task and the raw output of each tool.
 */

export type StageName = 'plan' | 'assign' | 'execute' | 'respond';
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';
export type MissionStatus = 'planning' | 'assigning' | 'executing' | 'responding' | 'completed' | 'failed';

export type ToolId = 'wikipedia' | 'weather' | 'country' | 'hackernews';

export interface MissionStage {
  name: StageName;
  label: string;
  status: StageStatus;
  detail?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface MissionTask {
  id: string;
  title: string;
  /** Department id of the agent that owns the task (matches dashboard departments). */
  agent: string;
  tool: ToolId;
  args: Record<string, string>;
  status: TaskStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  summary?: string;
  data?: unknown;
  sourceName?: string;
  sourceUrl?: string;
  error?: string;
}

export interface MissionSource {
  name: string;
  url: string;
}

export interface MissionSection {
  title: string;
  body: string;
  agent: string;
}

export interface MissionResult {
  headline: string;
  summary: string;
  sections: MissionSection[];
  sources: MissionSource[];
  writtenBy: 'llm' | 'template';
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
  template?: string;
  status: MissionStatus;
  createdAt: string;
  updatedAt: string;
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
  /** True for APIs that AgencyForge agents call out of the box. */
  featured?: boolean;
  name: string;
  description: string;
  category: string;
  auth: string;
  https: boolean;
  cors: string;
  url: string;
}

export interface ToolOutput {
  summary: string;
  data: unknown;
  sourceName: string;
  sourceUrl: string;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<FetchResponseLike>;

export interface AiCompletion {
  content: string;
  provider?: string;
  model?: string;
}

export type AiCompleter = (
  messages: Array<{ role: 'system' | 'user'; content: string }>,
) => Promise<AiCompletion>;
