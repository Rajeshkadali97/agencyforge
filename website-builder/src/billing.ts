import type { WebsiteDb } from './db/WebsiteDb';

export function emitBuildStarted(db: WebsiteDb, projectId: string, userId: string): void {
  db.createBillingEvent({
    projectId,
    userId,
    eventType: 'website.build.completed',
    quantity: 1,
  });
}

export function emitProductionDeploy(
  db: WebsiteDb,
  projectId: string,
  userId: string,
): void {
  db.createBillingEvent({
    projectId,
    userId,
    eventType: 'website.deploy.production',
    quantity: 1,
  });
}

export function emitImageGenerated(
  db: WebsiteDb,
  projectId: string,
  userId: string,
  count: number,
): void {
  db.createBillingEvent({
    projectId,
    userId,
    eventType: 'website.image.generated',
    quantity: count,
  });
}

export function emitRegeneration(
  db: WebsiteDb,
  projectId: string,
  userId: string,
): void {
  db.createBillingEvent({
    projectId,
    userId,
    eventType: 'website.regeneration',
    quantity: 1,
  });
}
