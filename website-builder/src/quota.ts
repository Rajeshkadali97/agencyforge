import { WebsiteBuilderQuotaError } from './errors';
import type { WebsiteDb } from './db/WebsiteDb';

export const MAX_CONCURRENT_BUILDS = 3;
export const MAX_PROJECTS_PER_USER = 10;

export function checkBuildQuota(db: WebsiteDb, userId: string): void {
  const activeBuilds = db.countActiveBuilds(userId);
  if (activeBuilds >= MAX_CONCURRENT_BUILDS) {
    throw new WebsiteBuilderQuotaError(
      'CONCURRENT_BUILD_LIMIT',
      activeBuilds,
      MAX_CONCURRENT_BUILDS,
    );
  }

  const projectCount = db.countUserProjects(userId);
  if (projectCount >= MAX_PROJECTS_PER_USER) {
    throw new WebsiteBuilderQuotaError(
      'PROJECT_LIMIT',
      projectCount,
      MAX_PROJECTS_PER_USER,
    );
  }
}
