import type { MissionTask, ToolId } from './types';
import { MISSION_TOOLS } from './tools';

/**
 * Stage 1 (plan) and stage 2 (assign).
 *
 * The built-in planner is deterministic and key-free so a fresh clone works
 * without any LLM. It reads the goal, extracts a topic and an optional place,
 * decides which tools are relevant and assigns each task to a department agent.
 */

export interface MissionPlan {
  topic: string;
  place?: string;
  tasks: MissionTask[];
  rationale: string[];
}

const WEATHER_WORDS = /\b(weather|forecast|temperature|climate|season|rain|outdoor|heat|cold)\b/i;
const COUNTRY_WORDS = /\b(country|nation|population|currency|language|market|expand|expansion|international|global|region|demographic|audience|locali[sz]e)\b/i;
const TREND_WORDS = /\b(trend|trends|trending|news|tech|technology|startup|startups|saas|ai|software|developer|launch|innovation|competitor|competitors)\b/i;

const FILLER = new Set([
  'research', 'analyse', 'analyze', 'find', 'build', 'create', 'plan', 'give', 'show', 'tell', 'brief', 'report',
  'prepare', 'write', 'draft', 'launch', 'scan', 'explore', 'investigate', 'summarise', 'summarize', 'help', 'please',
  'me', 'us', 'my', 'our', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'at', 'to', 'and', 'with', 'about', 'into',
  'from', 'near', 'around', 'then', 'also', 'plus', 'including', 'market', 'markets', 'opportunities', 'opportunity',
  'today', 'todays', "today's", 'current', 'latest', 'top', 'local', 'weather', 'forecast', 'temperature', 'climate',
  'trends', 'trend', 'country', 'profile', 'tech', 'check', 'pop-up', 'popup', 'outdoor', 'is', 'are', 'what', 'how', 'can', 'you', 'i', 'we', 'new',
]);

function cleanPlace(raw: string): string {
  return raw
    .replace(/\b(and|with|then|plus|including|for|to)\b.*$/i, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

/** Capitalised place name after a location preposition, e.g. "in Berlin" or "near New York". */
export function extractPlace(goal: string): string | undefined {
  const re = /\b(?:in|at|near|around|across|from|to)\s+((?:[A-Z][\p{L}'’.-]+)(?:\s+[A-Z][\p{L}'’.-]+){0,2})/gu;
  for (const m of goal.matchAll(re)) {
    const candidate = cleanPlace(m[1] ?? '');
    if (candidate && !/^(The|A|An|I|We|My|Our)$/.test(candidate)) return candidate;
  }
  return undefined;
}

export function extractTopic(goal: string, place?: string): string {
  const quoted = /["“]([^"”]{2,60})["”]/.exec(goal);
  if (quoted?.[1]) return quoted[1].trim();

  let text = goal;
  if (place) text = text.replace(new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  const words = text
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w.toLowerCase()));
  const topic = words.slice(0, 5).join(' ').trim();
  return topic || place || goal.trim().slice(0, 60);
}

function task(index: number, tool: ToolId, title: string, args: Record<string, string>): MissionTask {
  return {
    id: `t${index}`,
    title,
    agent: MISSION_TOOLS[tool].agent,
    tool,
    args,
    status: 'pending',
  };
}

export function planMission(goal: string): MissionPlan {
  const place = extractPlace(goal);
  const topic = extractTopic(goal, place);
  const tasks: MissionTask[] = [];
  const rationale: string[] = [];

  tasks.push(task(tasks.length + 1, 'wikipedia', `Research background on “${topic}”`, { topic }));
  rationale.push(`Every mission starts with background research on “${topic}”.`);

  const wantsWeather = WEATHER_WORDS.test(goal);
  const wantsCountry = COUNTRY_WORDS.test(goal);
  const wantsTrends = TREND_WORDS.test(goal);

  if (place && wantsWeather) {
    tasks.push(task(tasks.length + 1, 'weather', `Check current weather in ${place}`, { place }));
    rationale.push(`The goal mentions conditions in ${place}, so the analytics agent checks live weather.`);
  }
  if (place && (wantsCountry || !wantsWeather)) {
    tasks.push(task(tasks.length + 1, 'country', `Profile the ${place} market`, { place }));
    rationale.push(`A place (${place}) was named, so the marketing agent builds a market profile.`);
  }
  if (wantsTrends || tasks.length < 2) {
    tasks.push(task(tasks.length + 1, 'hackernews', 'Scan live tech trends', { keyword: topic.split(' ')[0] ?? '' }));
    rationale.push('The content agent scans what the tech community is discussing right now.');
  }

  return { topic, place, tasks, rationale };
}
