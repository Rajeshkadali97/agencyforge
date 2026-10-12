import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { WebsiteDb } from '../db/WebsiteDb';
import { createTables } from '../db/migration';
import { checkBuildQuota, MAX_CONCURRENT_BUILDS, MAX_PROJECTS_PER_USER } from '../quota';
import { WebsiteBuilderQuotaError } from '../errors';
import type { CreateProjectInput } from '../types';

function makeDb(): WebsiteDb {
  const rawDb = new Database(':memory:');
  rawDb.pragma('foreign_keys = ON');
  createTables(rawDb);
  return new WebsiteDb(rawDb);
}

const brief: CreateProjectInput['brief'] = {
  businessType: 'Agency',
  description: 'Digital agency',
  targetAudience: 'Small businesses',
  goals: ['leads', 'credibility'],
  stylePreference: 'corporate',
};

describe('checkBuildQuota', () => {
  let db: WebsiteDb;

  beforeEach(() => {
    db = makeDb();
  });

  it('passes when user has no projects', () => {
    expect(() => checkBuildQuota(db, 'user-1')).not.toThrow();
  });

  it('passes when active builds are below limit', () => {
    for (let i = 0; i < MAX_CONCURRENT_BUILDS - 1; i++) {
      db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
    }
    expect(() => checkBuildQuota(db, 'user-1')).not.toThrow();
  });

  it('throws CONCURRENT_BUILD_LIMIT when active builds reach limit', () => {
    for (let i = 0; i < MAX_CONCURRENT_BUILDS; i++) {
      db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
    }

    let caught: unknown;
    try {
      checkBuildQuota(db, 'user-1');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(WebsiteBuilderQuotaError);
    const quotaErr = caught as WebsiteBuilderQuotaError;
    expect(quotaErr.limit).toBe('CONCURRENT_BUILD_LIMIT');
    expect(quotaErr.current).toBe(MAX_CONCURRENT_BUILDS);
    expect(quotaErr.max).toBe(MAX_CONCURRENT_BUILDS);
  });

  it('passes after building projects move to preview', () => {
    for (let i = 0; i < MAX_CONCURRENT_BUILDS; i++) {
      const proj = db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
      db.updateProjectStatus(proj.id, 'preview');
    }
    expect(() => checkBuildQuota(db, 'user-1')).not.toThrow();
  });

  it('throws PROJECT_LIMIT when user reaches project cap', () => {
    for (let i = 0; i < MAX_PROJECTS_PER_USER; i++) {
      const proj = db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
      db.updateProjectStatus(proj.id, 'preview');
    }

    let caught: unknown;
    try {
      checkBuildQuota(db, 'user-1');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(WebsiteBuilderQuotaError);
    const quotaErr = caught as WebsiteBuilderQuotaError;
    expect(quotaErr.limit).toBe('PROJECT_LIMIT');
    expect(quotaErr.current).toBe(MAX_PROJECTS_PER_USER);
    expect(quotaErr.max).toBe(MAX_PROJECTS_PER_USER);
  });

  it('does not count archived projects toward PROJECT_LIMIT', () => {
    for (let i = 0; i < MAX_PROJECTS_PER_USER; i++) {
      const proj = db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
      db.updateProjectStatus(proj.id, 'preview');
      db.archiveProject(proj.id, 'user-1');
    }
    expect(() => checkBuildQuota(db, 'user-1')).not.toThrow();
  });

  it('isolates quota check by userId', () => {
    for (let i = 0; i < MAX_CONCURRENT_BUILDS; i++) {
      db.createProject({ name: `Site ${i}`, userId: 'user-1', brief });
    }
    expect(() => checkBuildQuota(db, 'user-2')).not.toThrow();
  });
});
