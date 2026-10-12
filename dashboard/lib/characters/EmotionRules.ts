import { EmotionalRule } from "./types";

const increased = (event: { value?: number; previousValue?: number }) =>
  typeof event.value === "number" && typeof event.previousValue === "number" && event.value > event.previousValue;

const decreased = (event: { value?: number; previousValue?: number }) =>
  typeof event.value === "number" && typeof event.previousValue === "number" && event.value < event.previousValue;

export const EMOTION_RULES: EmotionalRule[] = [
  {
    id: "revenue-up",
    description: "Revenue increased, so CEO celebrates.",
    eventType: "revenue.changed",
    characterId: "ceo",
    when: increased,
    state: { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", animations: ["celebration", "blinking"], status: "available" },
  },
  {
    id: "revenue-down",
    description: "Revenue decreased, so CEO becomes worried.",
    eventType: "revenue.changed",
    characterId: "ceo",
    when: decreased,
    state: { runtimeState: "Worried", emotion: "worried", pose: "thinking", animations: ["breathing", "blinking"], status: "warning" },
  },
  {
    id: "sales-kpi-down",
    description: "Sales KPI dropped, so Sales Agent becomes worried.",
    eventType: "sales.kpi.changed",
    characterId: "sales-agent",
    when: decreased,
    state: { runtimeState: "Worried", emotion: "worried", pose: "thinking", animations: ["breathing", "blinking"], status: "warning" },
  },
  {
    id: "sales-closed",
    description: "Closed sales make Sales Agent happy.",
    eventType: "sales.closed",
    characterId: "sales-agent",
    state: { runtimeState: "Happy", emotion: "happy", pose: "standing", animations: ["breathing", "blinking", "nodding"], status: "available" },
  },
  {
    id: "sales-lost",
    description: "Lost sales make Sales Agent sad.",
    eventType: "sales.lost",
    characterId: "sales-agent",
    state: { runtimeState: "Sad", emotion: "sad", pose: "thinking", animations: ["breathing", "shakingHead"], status: "warning" },
  },
  {
    id: "new-client-added",
    description: "New client added, so CEO celebrates.",
    eventType: "client.added",
    characterId: "ceo",
    state: { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", animations: ["celebration", "blinking"], status: "available" },
  },
  {
    id: "project-completed-owner",
    description: "Project owner celebrates when a project is completed.",
    eventType: "project.completed",
    state: { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", animations: ["celebration", "blinking"], status: "available" },
  },
  {
    id: "campaign-success",
    description: "Campaign success makes Marketing Agent happy.",
    eventType: "campaign.success",
    characterId: "marketing-agent",
    state: { runtimeState: "Happy", emotion: "happy", pose: "presenting", animations: ["handGestures", "blinking"], status: "available" },
  },
  {
    id: "campaign-successful",
    description: "Campaign success makes Marketing Agent happy.",
    eventType: "campaign.successful",
    characterId: "marketing-agent",
    state: { runtimeState: "Happy", emotion: "happy", pose: "presenting", animations: ["handGestures", "blinking"], status: "available" },
  },
  {
    id: "campaign-failed",
    description: "Campaign failure makes Marketing Agent sad.",
    eventType: "campaign.failed",
    characterId: "marketing-agent",
    state: { runtimeState: "Sad", emotion: "sad", pose: "thinking", animations: ["breathing", "shakingHead"], status: "warning" },
  },
  {
    id: "campaign-failure",
    description: "Campaign failure makes Marketing Agent sad.",
    eventType: "campaign.failure",
    characterId: "marketing-agent",
    state: { runtimeState: "Sad", emotion: "sad", pose: "thinking", animations: ["breathing", "shakingHead"], status: "warning" },
  },
  {
    id: "research-running",
    description: "Running research keeps Research Agent thinking.",
    eventType: "research.running",
    characterId: "research-agent",
    state: { runtimeState: "Thinking", emotion: "thinking", pose: "reading", animations: ["breathing", "eyeMovement"], status: "busy" },
  },
  {
    id: "creative-working",
    description: "Creative work moves Creative Director into focused drawing mode.",
    eventType: "creative.working",
    characterId: "creative-director",
    state: { runtimeState: "Busy", emotion: "sketching", pose: "writing", animations: ["handGestures", "blinking"], status: "busy" },
  },
  {
    id: "website-deploy-success",
    description: "Website deploy success makes Developer celebrate.",
    eventType: "website.deploy.success",
    characterId: "developer",
    state: { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", animations: ["celebration", "blinking"], status: "available" },
  },
  {
    id: "deployment-success",
    description: "Deployment success makes Developer celebrate.",
    eventType: "deployment.success",
    characterId: "developer",
    state: { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", animations: ["celebration", "blinking"], status: "available" },
  },
  {
    id: "bug-found",
    description: "Found bugs make Developer stressed.",
    eventType: "bug.found",
    characterId: "developer",
    state: { runtimeState: "Worried", emotion: "stressed", pose: "typing", animations: ["breathing", "eyeMovement"], status: "warning" },
  },
  {
    id: "critical-bug",
    description: "Critical bugs put Developer into error state.",
    eventType: "bug.critical",
    characterId: "developer",
    state: { runtimeState: "Error", emotion: "stressed", pose: "typing", animations: ["breathing", "eyeMovement"], status: "error" },
  },
  {
    id: "high-cpu",
    description: "High CPU makes Automation Agent worried.",
    eventType: "system.cpu.high",
    characterId: "automation-agent",
    state: { runtimeState: "Worried", emotion: "concerned", pose: "standing", animations: ["breathing", "eyeMovement"], status: "warning" },
  },
  {
    id: "zero-notifications",
    description: "Zero notifications returns Research Agent to idle.",
    eventType: "notifications.count.changed",
    characterId: "research-agent",
    when: (event) => event.value === 0,
    state: { runtimeState: "Idle", emotion: "neutral", pose: "idle", animations: ["breathing", "blinking", "idleSway"], status: "idle" },
  },
  {
    id: "seo-ranking-up",
    description: "SEO ranking gains make SEO Specialist present confidently.",
    eventType: "seo.ranking.changed",
    characterId: "seo-specialist",
    when: increased,
    state: { runtimeState: "Presenting", emotion: "ranking", pose: "presenting", animations: ["pointing", "blinking"], status: "available" },
  },
  {
    id: "analytics-warning",
    description: "Analytics warnings move Analytics Expert into warning state.",
    eventType: "analytics.warning",
    characterId: "analytics-expert",
    state: { runtimeState: "Worried", emotion: "warning", pose: "presenting", animations: ["breathing", "eyeMovement"], status: "warning" },
  },
];

