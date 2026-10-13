import { randomUUID } from 'node:crypto';
import type {
  AiCompleter,
  FetchLike,
  Mission,
  MissionResult,
  MissionSection,
  MissionSource,
  MissionStage,
  MissionTask,
  StageName,
} from './types';
import { planMission, type MissionPlan } from './planner';
import { llmPlan } from './llmPlanner';
import { suggestApis } from './catalog';
import { MISSION_TOOLS } from './tools';
import type { MissionStore } from './MissionStore';

export type MissionEventPublisher = (type: string, payload: Record<string, unknown>, missionId: string) => void;

export interface MissionServiceOptions {
  /** HTTP client used by tools. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Optional LLM used to plan and to write the brief. Without it rules plan and a template writes. */
  ai?: AiCompleter;
  publish?: MissionEventPublisher;
  /** Optional persistence. Missions are reloaded on start; unfinished ones are marked interrupted. */
  store?: MissionStore;
  maxMissions?: number;
  toolTimeoutMs?: number;
  aiTimeoutMs?: number;
}

export interface CreateMissionOptions {
  template?: string;
  /** Set to false to skip the LLM and always use the template writer. */
  useAi?: boolean;
}

const STAGE_LABELS: Record<StageName, string> = {
  plan: 'Plan',
  assign: 'Assign',
  execute: 'Execute',
  respond: 'Respond',
};

const MISSION_EVENT = {
  created: 'mission.created',
  stage: 'mission.stage',
  task: 'mission.task',
  completed: 'mission.completed',
  failed: 'mission.failed',
} as const;

function iso(): string {
  return new Date().toISOString();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export class MissionService {
  private readonly missions = new Map<string, Mission>();
  private readonly runs = new Map<string, Promise<void>>();
  private readonly fetchImpl: FetchLike;
  private readonly ai?: AiCompleter;
  private readonly publish?: MissionEventPublisher;
  private readonly store?: MissionStore;
  private readonly maxMissions: number;
  private readonly toolTimeoutMs: number;
  private readonly aiTimeoutMs: number;

  constructor(options: MissionServiceOptions = {}) {
    const globalFetch = (globalThis as { fetch?: unknown }).fetch as FetchLike | undefined;
    const impl = options.fetch ?? globalFetch;
    if (!impl) throw new Error('MissionService requires a fetch implementation (Node 18+ provides one)');
    this.fetchImpl = impl;
    this.ai = options.ai;
    this.publish = options.publish;
    this.store = options.store;
    this.maxMissions = options.maxMissions ?? 50;
    this.toolTimeoutMs = options.toolTimeoutMs ?? 8000;
    this.aiTimeoutMs = options.aiTimeoutMs ?? 6000;
    this.restore();
  }

  /** Load persisted missions. Anything that was still running died with the previous process. */
  private restore(): void {
    if (!this.store) return;
    try {
      for (const m of this.store.load(this.maxMissions)) {
        if (m.status !== 'completed' && m.status !== 'failed') {
          m.status = 'failed';
          m.error = 'Interrupted by a runtime restart.';
          m.updatedAt = iso();
          for (const s of m.stages) if (s.status === 'running') s.status = 'failed';
          for (const t of m.tasks) {
            if (t.status === 'running' || t.status === 'pending') {
              t.status = 'failed';
              t.error = 'Interrupted by a runtime restart.';
            }
          }
          this.persist(m);
        }
        this.missions.set(m.id, m);
      }
    } catch {
      // A broken store must never stop the runtime from starting.
    }
  }

  private persist(mission: Mission): void {
    if (!this.store) return;
    try {
      this.store.save(mission);
    } catch {
      // Persistence is best effort.
    }
  }

  create(goal: string, options: CreateMissionOptions = {}): Mission {
    const cleanGoal = goal.trim();
    if (cleanGoal.length < 3) throw new Error('goal must be at least 3 characters');
    if (cleanGoal.length > 500) throw new Error('goal must be at most 500 characters');

    const now = iso();
    const mission: Mission = {
      id: `msn_${randomUUID().slice(0, 8)}`,
      goal: cleanGoal,
      template: options.template,
      status: 'planning',
      createdAt: now,
      updatedAt: now,
      stages: (['plan', 'assign', 'execute', 'respond'] as StageName[]).map<MissionStage>((name) => ({
        name,
        label: STAGE_LABELS[name],
        status: 'pending',
      })),
      tasks: [],
      suggestedApis: [],
    };

    this.missions.set(mission.id, mission);
    this.evict();
    this.persist(mission);
    this.emit(MISSION_EVENT.created, mission, { goal: mission.goal });

    const run = this.run(mission, options.useAi !== false).finally(() => this.runs.delete(mission.id));
    this.runs.set(mission.id, run);
    return mission;
  }

  /** Release the persistence handle. Call on shutdown. */
  close(): void {
    try {
      this.store?.close?.();
    } catch {
      // nothing to do
    }
  }

  get(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  list(): Mission[] {
    return [...this.missions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Resolves when the mission pipeline finishes (used by tests and scripts). */
  async waitFor(id: string): Promise<Mission> {
    await this.runs.get(id);
    const mission = this.missions.get(id);
    if (!mission) throw new Error(`Unknown mission ${id}`);
    return mission;
  }

  // ── pipeline ───────────────────────────────────────────────────────────────

  private async run(mission: Mission, useAi: boolean): Promise<void> {
    try {
      // Stage 1 — plan
      this.setStage(mission, 'plan', 'running');
      let plan: MissionPlan | null = null;
      if (useAi && this.ai) {
        try {
          plan = await withTimeout(llmPlan(mission.goal, this.ai), this.aiTimeoutMs, 'LLM planner');
        } catch {
          plan = null; // fall back to the rule-based planner
        }
      }
      mission.plannedBy = plan ? 'llm' : 'rules';
      const finalPlan = plan ?? planMission(mission.goal);
      mission.tasks = finalPlan.tasks;
      mission.suggestedApis = suggestApis(`${finalPlan.topic} ${finalPlan.place ?? ''}`, 5);
      this.setStage(mission, 'plan', 'done', finalPlan.rationale.join(' '));

      // Stage 2 — assign
      mission.status = 'assigning';
      this.setStage(mission, 'assign', 'running');
      const assignment = finalPlan.tasks.map((t) => `${t.agent} agent → ${MISSION_TOOLS[t.tool].label}`).join('; ');
      this.setStage(mission, 'assign', 'done', assignment);

      // Stage 3 — execute (independent tasks run in parallel)
      mission.status = 'executing';
      this.setStage(mission, 'execute', 'running');
      await Promise.all(mission.tasks.map((t) => this.runTask(mission, t)));
      const failed = mission.tasks.filter((t) => t.status === 'failed').length;
      if (failed === mission.tasks.length) {
        this.setStage(mission, 'execute', 'failed', 'Every tool call failed.');
        throw new Error('Every tool call failed — check your network connection and try again.');
      }
      this.setStage(
        mission,
        'execute',
        'done',
        failed > 0 ? `${mission.tasks.length - failed} of ${mission.tasks.length} tasks succeeded.` : `All ${mission.tasks.length} tasks succeeded.`,
      );

      // Stage 4 — respond
      mission.status = 'responding';
      this.setStage(mission, 'respond', 'running');
      mission.result = await this.buildResult(mission, finalPlan.topic, useAi);
      this.setStage(
        mission,
        'respond',
        'done',
        mission.result.writtenBy === 'llm' ? `Written by ${mission.result.provider ?? 'LLM'}.` : 'Written by the built-in template (no LLM available).',
      );

      mission.status = 'completed';
      mission.updatedAt = iso();
      this.emit(MISSION_EVENT.completed, mission, { headline: mission.result.headline });
    } catch (err) {
      mission.status = 'failed';
      mission.error = err instanceof Error ? err.message : String(err);
      mission.updatedAt = iso();
      const running = mission.stages.find((s) => s.status === 'running');
      if (running) {
        running.status = 'failed';
        running.endedAt = iso();
      }
      this.emit(MISSION_EVENT.failed, mission, { error: mission.error });
    }
  }

  private async runTask(mission: Mission, task: MissionTask): Promise<void> {
    const tool = MISSION_TOOLS[task.tool];
    task.status = 'running';
    task.startedAt = iso();
    this.emit(MISSION_EVENT.task, mission, { taskId: task.id, status: task.status, agent: task.agent });
    const started = Date.now();
    try {
      const out = await tool.run(task.args, { fetch: this.fetchImpl, timeoutMs: this.toolTimeoutMs });
      task.status = 'done';
      task.summary = out.summary;
      task.data = out.data;
      task.sourceName = out.sourceName;
      task.sourceUrl = out.sourceUrl;
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
    } finally {
      task.endedAt = iso();
      task.durationMs = Date.now() - started;
      mission.updatedAt = task.endedAt;
      this.emit(MISSION_EVENT.task, mission, { taskId: task.id, status: task.status, agent: task.agent });
    }
  }

  private async buildResult(mission: Mission, topic: string, useAi: boolean): Promise<MissionResult> {
    const done = mission.tasks.filter((t) => t.status === 'done');
    const failed = mission.tasks.filter((t) => t.status === 'failed');

    const sections: MissionSection[] = done.map((t) => ({ title: t.title, body: t.summary ?? '', agent: t.agent }));
    if (failed.length > 0) {
      sections.push({
        title: 'Gaps',
        agent: 'ceo',
        body: failed.map((t) => `${t.title}: ${t.error ?? 'failed'}`).join(' '),
      });
    }

    const seen = new Set<string>();
    const sources: MissionSource[] = [];
    for (const t of done) {
      if (t.sourceUrl && !seen.has(t.sourceUrl)) {
        seen.add(t.sourceUrl);
        sources.push({ name: t.sourceName ?? t.sourceUrl, url: t.sourceUrl });
      }
    }

    const headline = `Mission brief: ${topic}`;
    const template = [
      `Your team completed ${done.length} of ${mission.tasks.length} tasks for “${mission.goal}”.`,
      ...done.map((t) => t.summary ?? ''),
    ]
      .filter(Boolean)
      .join(' ');

    if (useAi && this.ai) {
      try {
        const findings = done.map((t, i) => `${i + 1}. [${t.agent}] ${t.title}: ${t.summary}`).join('\n');
        const completion = await withTimeout(
          this.ai([
            {
              role: 'system',
              content:
                'You are the CEO of an AI agency. Write a concise executive brief of at most 120 words. ' +
                'Use ONLY the findings provided. Do not invent facts, numbers or sources. Plain text, no markdown headings.',
            },
            { role: 'user', content: `Goal: ${mission.goal}\n\nFindings:\n${findings}` },
          ]),
          this.aiTimeoutMs,
          'LLM summary',
        );
        const content = completion.content.trim();
        if (content.length > 20) {
          return { headline, summary: content, sections, sources, writtenBy: 'llm', provider: completion.provider, model: completion.model };
        }
      } catch {
        // Falls through to the template writer. The mission still succeeds.
      }
    }

    return { headline, summary: template, sections, sources, writtenBy: 'template' };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private setStage(mission: Mission, name: StageName, status: MissionStage['status'], detail?: string): void {
    const stage = mission.stages.find((s) => s.name === name);
    if (!stage) return;
    const now = iso();
    if (status === 'running') stage.startedAt = now;
    if (status === 'done' || status === 'failed') stage.endedAt = now;
    stage.status = status;
    if (detail !== undefined) stage.detail = detail;
    mission.updatedAt = now;
    this.emit(MISSION_EVENT.stage, mission, { stage: name, status, detail });
  }

  private emit(type: string, mission: Mission, extra: Record<string, unknown>): void {
    // Every state change goes through here, so persisting here keeps the store current.
    this.persist(mission);
    if (!this.publish) return;
    try {
      this.publish(type, { missionId: mission.id, status: mission.status, ...extra }, mission.id);
    } catch {
      // Event delivery must never break a mission.
    }
  }

  private evict(): void {
    if (this.missions.size <= this.maxMissions) return;
    const oldest = [...this.missions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const m of oldest) {
      if (this.missions.size <= this.maxMissions) break;
      if (!this.runs.has(m.id)) this.missions.delete(m.id);
    }
  }
}
