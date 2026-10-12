import { CharacterId } from "./types";

export const SCREEN_CHARACTER_MAP: Record<string, CharacterId[]> = {
  dashboard: ["ceo", "sales-agent", "marketing-agent"],
  hq: ["ceo", "sales-agent", "marketing-agent"],
  projects: ["web-architect", "developer"],
  research: ["research-agent"],
  reports: ["analytics-expert", "sales-agent", "marketing-agent"],
  settings: ["ceo", "automation-agent"],
  automation: ["automation-agent"],
  support: ["ceo"],
  chat: ["ceo"],
  "voice-assistant": ["ceo"],
  "notification-center": ["ceo"],
  sales: ["sales-agent"],
  marketing: ["marketing-agent"],
  creative: ["creative-director", "content-strategist", "motion-designer"],
  seo: ["seo-specialist"],
  analytics: ["analytics-expert"],
};

