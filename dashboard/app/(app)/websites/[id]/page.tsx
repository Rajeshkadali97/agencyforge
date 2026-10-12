import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Clock, CheckCircle, AlertCircle, Archive, Loader2 } from 'lucide-react';
import { getWebsiteDb } from '@agencyforge/website-builder';
import type { WebsiteProject, ProjectStatus, RawBrief } from '@agencyforge/website-builder';
import { getSessionUserId } from '@/lib/website-session';
import { ArchiveButton } from './ArchiveButton';

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config: Record<
    ProjectStatus,
    { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    draft: { label: 'Draft', className: 'bg-neutral-100 text-neutral-600', Icon: Clock },
    building: { label: 'Building', className: 'bg-blue-100 text-blue-700', Icon: Loader2 },
    preview: { label: 'Preview', className: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
    deployed: { label: 'Deployed', className: 'bg-green-100 text-green-800', Icon: CheckCircle },
    error: { label: 'Error', className: 'bg-red-100 text-red-700', Icon: AlertCircle },
    archived: { label: 'Archived', className: 'bg-neutral-100 text-neutral-400', Icon: Archive },
  };

  const { label, className, Icon } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function BriefSection({ project }: { project: WebsiteProject }) {
  let brief: RawBrief | null = null;
  try {
    brief = JSON.parse(project.briefJson) as RawBrief;
  } catch {
    brief = null;
  }

  if (!brief) return null;

  return (
    <div className="rounded-2xl border border-white/50 bg-white/40 backdrop-blur-sm p-6">
      <h2 className="text-sm font-semibold text-neutral-700 mb-4">Brief</h2>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-neutral-500 mb-0.5">Business type</dt>
          <dd className="text-sm text-neutral-800">{brief.businessType}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500 mb-0.5">Description</dt>
          <dd className="text-sm text-neutral-800 whitespace-pre-wrap">{brief.description}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500 mb-0.5">Target audience</dt>
          <dd className="text-sm text-neutral-800">{brief.targetAudience}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500 mb-0.5">Goals</dt>
          <dd className="flex flex-wrap gap-1.5 mt-1">
            {brief.goals.map(goal => (
              <span
                key={goal}
                className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium"
              >
                {goal}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-neutral-500 mb-0.5">Style</dt>
          <dd className="text-sm text-neutral-800 capitalize">{brief.stylePreference}</dd>
        </div>
      </dl>
    </div>
  );
}

type PageParams = { params: Promise<{ id: string }> };

export default async function WebsiteDetailPage({ params }: PageParams) {
  const { id } = await params;
  const userId = await getSessionUserId();

  if (!userId) notFound();

  const db = getWebsiteDb();
  const project = db.getProject(id, userId);

  if (!project) notFound();

  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/websites"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Websites
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 shadow-md">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-neutral-800 truncate">{project.name}</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                {project.outputFormat.toUpperCase()} · Created {createdDate}
              </p>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <BriefSection project={project} />

        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-white/20 p-6 text-center">
          <p className="text-sm text-neutral-500">
            AI build pipeline, file explorer, and preview available in Milestone 2.
          </p>
        </div>

        {project.status !== 'archived' && (
          <div className="mt-6 flex justify-end">
            <ArchiveButton projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}

