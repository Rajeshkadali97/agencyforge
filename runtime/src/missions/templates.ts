import type { MissionTemplate } from './types';

/** One-click starting points shown on the dashboard Missions screen. */
export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  {
    id: 'market-brief',
    title: 'Market brief',
    description: 'Background research, a country profile and live tech trends for a market you want to enter.',
    goal: 'Research the dental clinic market in Germany and brief me on the country and tech trends',
    agents: ['research', 'marketing', 'content'],
  },
  {
    id: 'launch-weather',
    title: 'Pop-up launch check',
    description: 'Plan a pop-up launch: venue city conditions plus background on the product category.',
    goal: 'Plan an outdoor coffee pop-up launch in Lisbon and check the weather',
    agents: ['research', 'analytics', 'marketing'],
  },
  {
    id: 'trend-radar',
    title: 'Trend radar',
    description: 'What the tech community is talking about right now, with background on a topic.',
    goal: 'Scan today’s top tech trends for AI agents',
    agents: ['research', 'content'],
  },
  {
    id: 'expansion-scout',
    title: 'Expansion scout',
    description: 'Profile a new region for a SaaS expansion and see how current conditions look.',
    goal: 'Find expansion opportunities for a SaaS startup in Singapore including weather and market profile',
    agents: ['research', 'analytics', 'marketing'],
  },
];
