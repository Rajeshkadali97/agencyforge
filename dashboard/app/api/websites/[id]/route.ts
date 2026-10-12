import { NextRequest, NextResponse } from 'next/server';
import {
  getWebsiteDb,
  sanitizeProjectName,
  WebsiteBuilderValidationError,
} from '@agencyforge/website-builder';
import { resolveUserId, setUserIdCookie } from '@/lib/website-session';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const { userId, isNew } = resolveUserId(request);

  if (isNew) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getWebsiteDb();
  const project = db.getProject(id, userId);

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  const { userId, isNew } = resolveUserId(request);

  if (isNew) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
  const input: { name?: string } = {};

  if (raw['name'] !== undefined) {
    if (typeof raw['name'] !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    try {
      input.name = sanitizeProjectName(raw['name']);
    } catch (err) {
      if (err instanceof WebsiteBuilderValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const db = getWebsiteDb();
  const updated = db.updateProject(id, userId, input);

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const project = db.getProject(id, userId);
  return NextResponse.json(project);
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { id } = await params;
  const { userId, isNew } = resolveUserId(request);

  if (isNew) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getWebsiteDb();
  const archived = db.archiveProject(id, userId);
  if (!archived) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ archived: true });
}
