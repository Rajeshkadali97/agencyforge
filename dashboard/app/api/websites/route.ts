import { NextRequest, NextResponse } from 'next/server';
import {
  getWebsiteDb,
  checkBuildQuota,
  sanitizeProjectName,
  sanitizeDescription,
  sanitizeBusinessType,
  sanitizeAudience,
  emitBuildStarted,
  WebsiteBuilderQuotaError,
  WebsiteBuilderValidationError,
} from '@agencyforge/website-builder';
import type { RawBrief, GoalType, StylePreference, OutputFormat } from '@agencyforge/website-builder';
import { resolveUserId, setUserIdCookie } from '@/lib/website-session';

const VALID_GOALS: GoalType[] = ['leads', 'sales', 'credibility', 'portfolio', 'info'];
const VALID_STYLES: StylePreference[] = ['minimal', 'bold', 'corporate', 'warm', 'creative'];
const VALID_FORMATS: OutputFormat[] = ['html', 'nextjs'];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId, isNew } = resolveUserId(request);
  if (isNew) {
    const response = NextResponse.json({ projects: [], total: 0 });
    setUserIdCookie(response, userId);
    return response;
  }

  const db = getWebsiteDb();
  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offsetRaw = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = isNaN(limitRaw) ? 50 : Math.min(100, Math.max(1, limitRaw));
  const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw);

  const result = db.listProjects({
    userId,
    limit,
    offset,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, isNew } = resolveUserId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw['name'] !== 'string') {
    return NextResponse.json({ error: 'name is required and must be a string' }, { status: 400 });
  }
  if (typeof raw['brief'] !== 'object' || raw['brief'] === null) {
    return NextResponse.json({ error: 'brief is required' }, { status: 400 });
  }

  const briefRaw = raw['brief'] as Record<string, unknown>;

  if (typeof briefRaw['businessType'] !== 'string') {
    return NextResponse.json({ error: 'brief.businessType is required' }, { status: 400 });
  }
  if (typeof briefRaw['description'] !== 'string') {
    return NextResponse.json({ error: 'brief.description is required' }, { status: 400 });
  }
  if (typeof briefRaw['targetAudience'] !== 'string') {
    return NextResponse.json({ error: 'brief.targetAudience is required' }, { status: 400 });
  }
  if (!Array.isArray(briefRaw['goals']) || briefRaw['goals'].length === 0) {
    return NextResponse.json({ error: 'brief.goals must be a non-empty array' }, { status: 400 });
  }
  if (typeof briefRaw['stylePreference'] !== 'string') {
    return NextResponse.json({ error: 'brief.stylePreference is required' }, { status: 400 });
  }

  const goals = briefRaw['goals'] as unknown[];
  if (!goals.every(g => VALID_GOALS.includes(g as GoalType))) {
    return NextResponse.json(
      { error: `brief.goals must be one of: ${VALID_GOALS.join(', ')}` },
      { status: 400 },
    );
  }

  if (!VALID_STYLES.includes(briefRaw['stylePreference'] as StylePreference)) {
    return NextResponse.json(
      { error: `brief.stylePreference must be one of: ${VALID_STYLES.join(', ')}` },
      { status: 400 },
    );
  }

  const outputFormat = raw['outputFormat'];
  if (outputFormat !== undefined && !VALID_FORMATS.includes(outputFormat as OutputFormat)) {
    return NextResponse.json(
      { error: `outputFormat must be one of: ${VALID_FORMATS.join(', ')}` },
      { status: 400 },
    );
  }

  let name: string;
  let brief: RawBrief;

  try {
    name = sanitizeProjectName(raw['name'] as string);
    const businessType = sanitizeBusinessType(briefRaw['businessType'] as string);
    const description = sanitizeDescription(briefRaw['description'] as string);
    const targetAudience = sanitizeAudience(briefRaw['targetAudience'] as string);

    brief = {
      businessType,
      description,
      targetAudience,
      goals: goals as GoalType[],
      stylePreference: briefRaw['stylePreference'] as StylePreference,
      colorHint:
        typeof briefRaw['colorHint'] === 'string' ? briefRaw['colorHint'] : undefined,
    };
  } catch (err) {
    if (err instanceof WebsiteBuilderValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const db = getWebsiteDb();

  let project;
  try {
    project = db.runTransaction(() => {
      checkBuildQuota(db, userId);
      return db.createProject({
        name,
        userId,
        brief,
        outputFormat: outputFormat as OutputFormat | undefined,
      });
    });
  } catch (err) {
    if (err instanceof WebsiteBuilderQuotaError) {
      return NextResponse.json(
        { error: err.message, limit: err.limit, current: err.current, max: err.max },
        { status: 429 },
      );
    }
    throw err;
  }

  // M1 mock: immediately transition to preview (no AI pipeline yet)
  db.updateProjectStatus(project.id, 'preview');
  emitBuildStarted(db, project.id, userId);

  const updated = db.getProject(project.id, userId);

  const response = NextResponse.json(updated, { status: 201 });
  if (isNew) {
    setUserIdCookie(response, userId);
  }
  return response;
}
