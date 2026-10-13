import type { AiCompleter, MissionTask, ToolId } from './types';
import type { MissionPlan } from './planner';
import { MISSION_TOOLS } from './tools';

/**
 * LLM planner (optional).
 *
 * The model proposes a task list as JSON. Nothing it returns is trusted: tool
 * names must exist in the registry, arguments must be short plain strings, and
 * at most five tasks are accepted. Any problem returns null, and the caller
 * falls back to the deterministic rule-based planner.
 */

const MAX_TASKS = 5;
const MAX_ARG_LENGTH = 80;

/** Required argument per tool. `hackernews` keyword may be empty. */
const REQUIRED_ARG: Record<ToolId, { name: string; optional?: boolean }> = {
  wikipedia: { name: 'topic' },
  weather: { name: 'place' },
  country: { name: 'place' },
  hackernews: { name: 'keyword', optional: true },
};

const SYSTEM_PROMPT = [
  'You plan work for an AI agency. Reply with ONLY one JSON object, no prose, no markdown.',
  'Schema: {"topic": string, "tasks": [{"tool": string, "args": object}]}',
  'Available tools:',
  '- wikipedia: args {"topic": string}  background research on a topic',
  '- weather: args {"place": string}  current weather for a city',
  '- country: args {"place": string}  market profile (population, income) for a city or country',
  '- hackernews: args {"keyword": string}  live tech-community trend scan',
  `Use between 1 and ${MAX_TASKS} tasks. Use only the tools above. Keep every string under ${MAX_ARG_LENGTH} characters.`,
].join('\n');

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.replace(/\s+/g, ' ').trim();
  if (v.length === 0 || v.length > MAX_ARG_LENGTH) return null;
  if (/[<>{}]|:\/\//.test(v)) return null;
  return v;
}

function titleFor(tool: ToolId, args: Record<string, string>): string {
  switch (tool) {
    case 'wikipedia':
      return `Research background on “${args['topic']}”`;
    case 'weather':
      return `Check current weather in ${args['place']}`;
    case 'country':
      return `Profile the ${args['place']} market`;
    case 'hackernews':
      return 'Scan live tech trends';
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Validate an untrusted model answer. Exported for tests. */
export function parseLlmPlan(text: string, goal: string): MissionPlan | null {
  const raw = extractJson(text);
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { topic?: unknown; tasks?: unknown };
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) return null;

  const tasks: MissionTask[] = [];
  const seen = new Set<string>();

  for (const item of obj.tasks.slice(0, MAX_TASKS)) {
    if (!item || typeof item !== 'object') continue;
    const { tool, args } = item as { tool?: unknown; args?: unknown };
    if (typeof tool !== 'string' || !(tool in MISSION_TOOLS)) continue;
    const toolId = tool as ToolId;
    const rule = REQUIRED_ARG[toolId];
    const given = args && typeof args === 'object' ? (args as Record<string, unknown>)[rule.name] : undefined;
    let value = cleanString(given);
    if (value === null) {
      if (!rule.optional) continue;
      value = '';
    }
    const key = `${toolId}:${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const taskArgs = { [rule.name]: value } as Record<string, string>;
    tasks.push({
      id: `t${tasks.length + 1}`,
      title: titleFor(toolId, taskArgs),
      agent: MISSION_TOOLS[toolId].agent,
      tool: toolId,
      args: taskArgs,
      status: 'pending',
    });
  }

  if (tasks.length === 0) return null;

  const firstWiki = tasks.find((t) => t.tool === 'wikipedia')?.args['topic'];
  const topic = cleanString(obj.topic) ?? firstWiki ?? goal.slice(0, 60);
  const places = [...new Set(tasks.filter((t) => t.args['place']).map((t) => t.args['place'] as string))];

  return {
    topic,
    place: places[0],
    places,
    tasks,
    rationale: [`An LLM proposed ${tasks.length} task${tasks.length === 1 ? '' : 's'}; each tool and argument was validated against the registry.`],
  };
}

export async function llmPlan(goal: string, ai: AiCompleter): Promise<MissionPlan | null> {
  const completion = await ai([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Goal: ${goal}` },
  ]);
  return parseLlmPlan(completion.content, goal);
}
