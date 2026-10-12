export type ProjectStatus =
  | 'draft'
  | 'building'
  | 'preview'
  | 'deployed'
  | 'error'
  | 'archived';

export type OutputFormat = 'html' | 'nextjs';

export type GoalType = 'leads' | 'sales' | 'credibility' | 'portfolio' | 'info';

export type StylePreference = 'minimal' | 'bold' | 'corporate' | 'warm' | 'creative';

export interface RawBrief {
  businessType: string;
  description: string;
  targetAudience: string;
  goals: GoalType[];
  stylePreference: StylePreference;
  colorHint?: string;
  importUrl?: string;
}

export interface WebsiteProject {
  readonly id: string;
  readonly userId: string;
  name: string;
  status: ProjectStatus;
  briefJson: string;
  analyzedJson: string | null;
  specJson: string | null;
  designJson: string | null;
  outputFormat: OutputFormat;
  githubRepoUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WebsiteProjectSummary {
  readonly id: string;
  name: string;
  status: ProjectStatus;
  outputFormat: OutputFormat;
  createdAt: number;
  updatedAt: number;
}

export interface WebsitePage {
  readonly id: string;
  readonly projectId: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  status: 'pending' | 'generating' | 'done' | 'error';
  errorMessage: string | null;
  generatedAt: number | null;
}

export interface WebsiteFile {
  readonly id: string;
  readonly projectId: string;
  pageId: string | null;
  path: string;
  content: string;
  sizeBytes: number;
  version: number;
  createdAt: number;
}

export interface WebsiteFileVersion {
  readonly id: string;
  readonly projectId: string;
  filePath: string;
  version: number;
  content: string;
  createdAt: number;
}

export interface WebsiteDeploy {
  readonly id: string;
  readonly projectId: string;
  type: 'preview' | 'production';
  status: 'pending' | 'building' | 'ready' | 'error';
  deployUrl: string | null;
  vercelDeployId: string | null;
  commitSha: string | null;
  errorMessage: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface WebsiteBuildEvent {
  readonly id: string;
  readonly projectId: string;
  stage: string;
  pageSlug: string | null;
  status: 'started' | 'completed' | 'failed';
  message: string | null;
  durationMs: number | null;
  tokenUsage: number | null;
  createdAt: number;
}

export interface BillingEventData {
  projectId: string;
  userId: string;
  eventType:
    | 'website.build.completed'
    | 'website.deploy.production'
    | 'website.image.generated'
    | 'website.regeneration';
  quantity: number;
  metadataJson?: string;
}

export interface CreateProjectInput {
  name: string;
  userId: string;
  brief: RawBrief;
  outputFormat?: OutputFormat;
}

export interface ListProjectsInput {
  userId: string;
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

export interface ListProjectsResult {
  projects: WebsiteProjectSummary[];
  total: number;
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
  analyzedJson?: string;
  specJson?: string;
  designJson?: string;
  githubRepoUrl?: string;
}
