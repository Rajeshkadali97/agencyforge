export type RevenueServiceCategory =
  | "website_development"
  | "application_development"
  | "software_development"
  | "agentic_systems"
  | "creative_production"
  | "social_media_growth"
  | "search_visibility";

export interface RevenueServiceOffering {
  readonly id: string;
  readonly category: RevenueServiceCategory;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly painSignals: readonly string[];
  readonly pitchAngles: readonly string[];
}

export interface InternationalLeadTargetProfile {
  readonly id: string;
  readonly geography: "global";
  readonly industries: readonly string[];
  readonly companyTypes: readonly string[];
  readonly services: readonly RevenueServiceOffering[];
  readonly languageHints: readonly string[];
}

export const revenueEngineServiceOfferings: readonly RevenueServiceOffering[] = [
  {
    id: "cinematic-websites",
    category: "website_development",
    name: "Cinematic websites",
    keywords: ["cinematic website", "premium website", "brand website", "interactive website"],
    painSignals: ["outdated website", "low trust", "weak brand presence", "poor conversion"],
    pitchAngles: ["turn the website into a premium brand experience", "make visitors feel the value before a sales call"]
  },
  {
    id: "awwwards-style-websites",
    category: "website_development",
    name: "Awwwards-style websites",
    keywords: ["awwwards website", "award winning website", "creative website", "high-end web design"],
    painSignals: ["generic website", "low differentiation", "weak visual identity"],
    pitchAngles: ["create a memorable site that separates the business from template competitors"]
  },
  {
    id: "3d-websites",
    category: "website_development",
    name: "3D websites",
    keywords: ["3d website", "webgl website", "three.js website", "immersive website"],
    painSignals: ["complex product is hard to explain", "low engagement", "premium offer needs better presentation"],
    pitchAngles: ["use interactive 3D to explain complex products and increase engagement"]
  },
  {
    id: "mobile-apps",
    category: "application_development",
    name: "Mobile apps",
    keywords: ["mobile app", "ios app", "android app", "cross-platform app"],
    painSignals: ["manual customer workflow", "missing app experience", "retention problem"],
    pitchAngles: ["turn repeated customer actions into a smooth mobile experience"]
  },
  {
    id: "web-apps",
    category: "application_development",
    name: "Web apps",
    keywords: ["web app", "saas app", "customer portal", "internal dashboard"],
    painSignals: ["spreadsheet operations", "manual reporting", "customer onboarding friction"],
    pitchAngles: ["replace manual workflows with a clean web application"]
  },
  {
    id: "software",
    category: "software_development",
    name: "Custom software",
    keywords: ["custom software", "automation software", "internal tool", "business software"],
    painSignals: ["manual operations", "tool fragmentation", "slow delivery", "data silos"],
    pitchAngles: ["build software around the business process instead of forcing the process into generic tools"]
  },
  {
    id: "agents",
    category: "agentic_systems",
    name: "Agents and business agents",
    keywords: ["ai agent", "business agent", "automation agent", "sales agent", "support agent"],
    painSignals: ["repetitive work", "slow response time", "manual lead handling", "operations bottleneck"],
    pitchAngles: ["deploy agents that handle repetitive business work with traceable handoffs"]
  },
  {
    id: "agentic-ecosystems",
    category: "agentic_systems",
    name: "Agentic ecosystems for business",
    keywords: ["agentic ecosystem", "multi-agent system", "ai workflow", "business automation"],
    painSignals: ["disconnected teams", "manual handoffs", "lost context", "slow execution"],
    pitchAngles: ["connect discovery, sales, creative, delivery, and CRM into one operating system"]
  },
  {
    id: "video-editing",
    category: "creative_production",
    name: "Video editing",
    keywords: ["video editing", "short form video", "reels editing", "youtube editing"],
    painSignals: ["inconsistent content", "low watch time", "weak creative quality"],
    pitchAngles: ["turn raw content into sharper assets for attention and trust"]
  },
  {
    id: "social-media-marketing",
    category: "social_media_growth",
    name: "Social media marketing, management, and promotions",
    keywords: ["social media marketing", "social media management", "social media promotion", "instagram growth"],
    painSignals: ["inconsistent posting", "low engagement", "weak inbound demand"],
    pitchAngles: ["build a consistent social presence that compounds trust and demand"]
  },
  {
    id: "seo",
    category: "search_visibility",
    name: "SEO and website SEO",
    keywords: ["seo", "technical seo", "website seo", "local seo", "content seo"],
    painSignals: ["low organic traffic", "poor rankings", "thin content", "technical seo issues"],
    pitchAngles: ["increase qualified search visibility with technical and content improvements"]
  },
  {
    id: "gmb-management",
    category: "search_visibility",
    name: "GMB management",
    keywords: ["google business profile", "gmb management", "google maps ranking", "local search"],
    painSignals: ["low map visibility", "few reviews", "incomplete business profile", "local competitors outrank them"],
    pitchAngles: ["improve local trust and discovery through Google Business Profile management"]
  }
];

export const globalAllIndustriesTargetProfile: InternationalLeadTargetProfile = {
  id: "global-all-industries",
  geography: "global",
  industries: ["all"],
  companyTypes: ["startup", "local business", "agency", "creator business", "professional services", "ecommerce", "saas", "enterprise"],
  services: revenueEngineServiceOfferings,
  languageHints: ["en", "es", "fr", "de", "pt", "it", "nl", "ar", "hi", "ja", "ko"]
};
