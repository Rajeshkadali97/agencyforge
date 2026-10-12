import Link from 'next/link';
import { Globe, Plus, Clock, CheckCircle, AlertCircle, Archive, Loader2 } from 'lucide-react';
import { getWebsiteDb } from '@agencyforge/website-builder';
import type { WebsiteProjectSummary, ProjectStatus } from '@agencyforge/website-builder';
import { getSessionUserId } from '@/lib/website-session';

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

function ProjectCard({ project }: { project: WebsiteProjectSummary }) {
  const createdDate = new Date(project.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link
      href={`/websites/${project.id}`}
      className="group block rounded-2xl border border-white/50 bg-white/40 backdrop-blur-sm p-5 hover:bg-white/70 hover:shadow-lg transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 shadow-md">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-800 truncate text-sm group-hover:text-indigo-700 transition-colors">
              {project.name}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {project.outputFormat.toUpperCase()} · Created {createdDate}
            </p>
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 shadow-lg mb-5">
        <Globe className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-xl font-bold text-neutral-800 mb-2">No websites yet</h2>
      <p className="text-neutral-500 text-sm max-w-xs mb-6">
        Build your first AI-generated website in minutes. Describe your business and we handle the
        rest.
      </p>
      <Link
        href="/websites/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-violet-600 hover:to-indigo-600 transition-all"
      >
        <Plus className="h-4 w-4" />
        New Website
      </Link>
    </div>
  );
}

export default async function WebsitesPage() {
  const userId = await getSessionUserId();

  let projects: WebsiteProjectSummary[] = [];
  let total = 0;

  if (userId) {
    const db = getWebsiteDb();
    const result = db.listProjects({ userId });
    projects = result.projects;
    total = result.total;
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-800">Websites</h1>
            {total > 0 && (
              <p className="text-sm text-neutral-500 mt-1">
                {total} project{total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {projects.length > 0 && (
            <Link
              href="/websites/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-violet-600 hover:to-indigo-600 transition-all"
            >
              <Plus className="h-4 w-4" />
              New Website
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
