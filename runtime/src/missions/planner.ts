import type { MissionTask, ToolId } from './types';
import { MISSION_TOOLS } from './tools';

/**
 * Stage 1 (plan) and stage 2 (assign).
 *
 * The built-in planner is deterministic and key-free so a fresh clone works
 * without any LLM. It reads the goal, extracts a topic and up to two places,
 * decides which tools are relevant and assigns each task to a department agent.
 */

export interface MissionPlan {
  topic: string;
  /** First place named in the goal, kept for convenience. */
  place?: string;
  places: string[];
  tasks: MissionTask[];
  rationale: string[];
}

const WEATHER_WORDS =
  /\b(weather|forecast|temperature|climate|season|rain|raining|snow|storm|sunny|outdoor|heat|cold|visit|visiting|travel|trip|vacation|holiday|spring|summer|autumn|winter)\b/i;
const COUNTRY_WORDS =
  /\b(country|nation|population|currency|language|market|expand|expansion|international|global|region|demographic|audience|locali[sz]e|franchise|branch|office|economy|gdp|income|compare|versus|vs)\b/i;
const TREND_WORDS =
  /\b(trend|trends|trending|news|tech|technology|startup|startups|saas|ai|software|developer|launch|innovation|competitor|competitors)\b/i;

/** Words that signal the goal is about a location, which unlocks looser place detection. */
const LOCATION_INTENT =
  /\b(weather|forecast|temperature|climate|visit|visiting|travel|trip|vacation|holiday|country|expand|expansion|international|franchise|store|shop|restaurant|cafe|office|branch|location|city|region|compare|versus|vs)\b/i;

const FILLER = new Set([
  'research', 'analyse', 'analyze', 'find', 'build', 'create', 'plan', 'give', 'show', 'tell', 'brief', 'report',
  'prepare', 'write', 'draft', 'launch', 'scan', 'explore', 'investigate', 'summarise', 'summarize', 'help', 'please',
  'me', 'us', 'my', 'our', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'at', 'to', 'and', 'with', 'about', 'into',
  'from', 'near', 'around', 'then', 'also', 'plus', 'including', 'market', 'markets', 'opportunities', 'opportunity',
  'today', 'todays', "today's", 'current', 'latest', 'top', 'local', 'weather', 'forecast', 'temperature', 'climate',
  'trends', 'trend', 'country', 'profile', 'tech', 'check', 'pop-up', 'popup', 'outdoor', 'is', 'are', 'what', 'how',
  'can', 'you', 'i', 'we', 'new', 'compare', 'versus', 'vs', 'best', 'time', 'visit', 'visiting', 'travel', 'trip',
  'which', 'when', 'where', 'why', 'who', 'should', 'would', 'could', 'does', 'do', 'is', 'be', 'it', 'its', 'this',
  'that', 'these', 'those', 'spring', 'summer', 'autumn', 'winter', 'season', 'right', 'now', 'there', 'their',
]);

/** Capitalised words that are not places. */
const NOT_PLACES = new Set([
  'The', 'A', 'An', 'I', 'We', 'My', 'Our', 'Your', 'This', 'That', 'These', 'Those', 'It', 'And', 'But', 'Or',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Hindi', 'Arabic',
  'Rust', 'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Kotlin', 'Swift', 'Ruby', 'Perl', 'Linux', 'Windows',
  'Android', 'iOS', 'macOS', 'Docker', 'Kubernetes', 'React', 'Vue', 'Angular', 'Node', 'GitHub', 'GitLab', 'Google',
  'Microsoft', 'Apple', 'Amazon', 'Meta', 'OpenAI', 'Anthropic', 'Tesla', 'Netflix', 'Stripe', 'Shopify',
  'AI', 'API', 'SaaS', 'SEO', 'CEO', 'CTO', 'B2B', 'B2C', 'LLM', 'ML', 'UX', 'UI', 'CRM', 'ERP',
]);

/** Lowercase words that follow "in/at/near" but are not places. */
const NOT_LOWERCASE_PLACES = new Set([
  'the', 'a', 'an', 'my', 'our', 'your', 'this', 'that', 'these', 'those', 'order', 'general', 'particular',
  'production', 'minutes', 'time', 'depth', 'advance', 'addition', 'summary', 'short', 'practice', 'total', 'case',
  'terms', 'need', 'mind', 'spring', 'summer', 'autumn', 'fall', 'winter', 'season', 'months', 'days', 'weeks',
  'hours', 'future', 'past', 'real', 'detail', 'fact', 'line', 'progress', 'place', 'person', 'parallel', 'sync',
  'full', 'bulk', 'batch', 'sequence', 'stages', 'steps', 'one', 'two', 'three', 'each', 'every', 'all', 'both',
  'and', 'with', 'for', 'to', 'then', 'check', 'plus', 'including', 'during', 'next', 'order', 'brief',
]);

function cleanPlace(raw: string): string {
  return raw
    .replace(/\b(and|with|then|plus|including|for|to)\b.*$/i, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

const CAPITAL = String.raw`[A-Z][\p{L}'’.-]+`;

function isAcronym(token: string): boolean {
  return /^[A-Z0-9&.]{2,5}$/.test(token);
}

/**
 * Place names in the goal, in order of appearance (at most `max`).
 *
 * 1. Capitalised names after a location preposition: "in Berlin", "near New York".
 * 2. Capitalised names elsewhere, when the goal has location intent: "Compare Tokyo and Osaka".
 * 3. Lowercase names after "in/at/near", only with strong intent: "weather in paris".
 */
export function extractPlaces(goal: string, max = 2): string[] {
  const found: string[] = [];
  const push = (raw: string) => {
    const name = cleanPlace(raw);
    if (!name || NOT_PLACES.has(name) || isAcronym(name)) return;
    if (name.split(/\s+/).some((w) => NOT_PLACES.has(w) && name.split(/\s+/).length === 1)) return;
    if (!found.some((f) => f.toLowerCase() === name.toLowerCase())) found.push(name);
  };

  // 1. preposition + capitalised phrase (may be followed by "and Another City")
  const phrase = String.raw`${CAPITAL}(?:\s+${CAPITAL}){0,2}`;
  const joiner = String.raw`\s*(?:,|&|\band\b|\bor\b|\bvs\.?|\bversus\b)\s*`;
  const prep = new RegExp(
    String.raw`\b(?:in|at|near|around|across|from|to|visit|visiting|toward|towards)\s+(${phrase}(?:${joiner}${phrase})*)`,
    'gu',
  );
  const splitter = new RegExp(joiner, 'iu');
  for (const m of goal.matchAll(prep)) {
    for (const part of (m[1] ?? '').split(splitter)) push(part);
  }

  // 2. any capitalised phrase, not at the start of a sentence, when the goal is about a location
  if (found.length === 0 && LOCATION_INTENT.test(goal)) {
    const caps = new RegExp(String.raw`(?<![.!?]\s)(?<!^)\b(${CAPITAL}(?:\s+${CAPITAL}){0,2})`, 'gu');
    for (const m of goal.matchAll(caps)) push(m[1] ?? '');
  }

  // 3. lowercase place after "in/at/near", only with strong weather or travel intent
  if (found.length === 0 && /\b(weather|forecast|temperature|climate|visit|visiting|travel|trip|vacation|holiday)\b/i.test(goal)) {
    const lower = /\b(?:in|at|near|around|to)\s+([a-z][\p{L}'’-]{2,}(?:\s+[a-z][\p{L}'’-]{2,})?)/gu;
    for (const m of goal.matchAll(lower)) {
      const words = (m[1] ?? '').split(/\s+/);
      const first = words[0] ?? '';
      if (NOT_LOWERCASE_PLACES.has(first)) continue;
      const kept: string[] = [];
      for (const w of words) {
        if (NOT_LOWERCASE_PLACES.has(w)) break;
        kept.push(w);
      }
      if (kept.length) {
        push(kept.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        break;
      }
    }
  }

  return found.slice(0, max);
}

/** First place named in the goal. */
export function extractPlace(goal: string): string | undefined {
  return extractPlaces(goal, 1)[0];
}

export function extractTopic(goal: string, place?: string | string[]): string {
  const quoted = /["“]([^"”]{2,60})["”]/.exec(goal);
  if (quoted?.[1]) return quoted[1].trim();

  let text = goal;
  const places = Array.isArray(place) ? place : place ? [place] : [];
  for (const p of places) {
    text = text.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  const words = text
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter(Boolean)
    .filter((w) => !FILLER.has(w.toLowerCase()));
  const topic = words.slice(0, 5).join(' ').trim();
  return topic || places[0] || goal.trim().slice(0, 60);
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
  const places = extractPlaces(goal, 2);
  const place = places[0];
  const topic = extractTopic(goal, places);
  const tasks: MissionTask[] = [];
  const rationale: string[] = [];

  tasks.push(task(tasks.length + 1, 'wikipedia', `Research background on “${topic}”`, { topic }));
  rationale.push(`Every mission starts with background research on “${topic}”.`);

  const wantsWeather = WEATHER_WORDS.test(goal);
  const wantsCountry = COUNTRY_WORDS.test(goal);
  const wantsTrends = TREND_WORDS.test(goal);

  if (places.length > 0 && wantsWeather) {
    for (const p of places) {
      tasks.push(task(tasks.length + 1, 'weather', `Check current weather in ${p}`, { place: p }));
    }
    rationale.push(
      `The goal mentions conditions in ${places.join(' and ')}, so the analytics agent checks live weather.`,
    );
  }
  if (place && (wantsCountry || !wantsWeather)) {
    tasks.push(task(tasks.length + 1, 'country', `Profile the ${place} market`, { place }));
    rationale.push(`A place (${place}) was named, so the marketing agent builds a market profile.`);
  }
  if (wantsTrends || tasks.length < 2) {
    tasks.push(task(tasks.length + 1, 'hackernews', 'Scan live tech trends', { keyword: topic.split(' ')[0] ?? '' }));
    rationale.push('The content agent scans what the tech community is discussing right now.');
  }

  return { topic, place, places, tasks, rationale };
}
