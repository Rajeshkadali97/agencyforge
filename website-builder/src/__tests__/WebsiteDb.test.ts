import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { WebsiteDb } from '../db/WebsiteDb';
import { createTables } from '../db/migration';
import type { CreateProjectInput } from '../types';

function makeDb(): WebsiteDb {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables(db);
  return new WebsiteDb(db);
}

const briefA: CreateProjectInput['brief'] = {
  businessType: 'SaaS',
  description: 'A productivity tool',
  targetAudience: 'Remote teams',
  goals: ['leads'],
  stylePreference: 'minimal',
};

describe('WebsiteDb', () => {
  let db: WebsiteDb;

  beforeEach(() => {
    db = makeDb();
  });

  describe('createProject', () => {
    it('creates project with status building', () => {
      const project = db.createProject({
        name: 'My Site',
        userId: 'user-1',
        brief: briefA,
      });

      expect(project.id).toBeTruthy();
      expect(project.userId).toBe('user-1');
      expect(project.name).toBe('My Site');
      expect(project.status).toBe('building');
      expect(project.outputFormat).toBe('html');
      expect(project.createdAt).toBeGreaterThan(0);
      expect(project.briefJson).toBe(JSON.stringify(briefA));
    });

    it('respects provided outputFormat', () => {
      const project = db.createProject({
        name: 'Next Site',
        userId: 'user-1',
        brief: briefA,
        outputFormat: 'nextjs',
      });
      expect(project.outputFormat).toBe('nextjs');
    });

    it('generates unique ids for concurrent projects', () => {
      const a = db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      const b = db.createProject({ name: 'B', userId: 'user-1', brief: briefA });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('getProject', () => {
    it('returns project when id and userId match', () => {
      const created = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      const fetched = db.getProject(created.id, 'user-1');
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
    });

    it('returns null when userId does not match (isolation)', () => {
      const created = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      const result = db.getProject(created.id, 'user-2');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent id', () => {
      expect(db.getProject('nonexistent-id', 'user-1')).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('returns only non-archived projects for user', () => {
      db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      db.createProject({ name: 'B', userId: 'user-1', brief: briefA });
      db.createProject({ name: 'C', userId: 'user-2', brief: briefA });

      const result = db.listProjects({ userId: 'user-1' });
      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.projects.every(p => p.name !== 'C')).toBe(true);
    });

    it('excludes archived projects from default listing', () => {
      const proj = db.createProject({ name: 'To Archive', userId: 'user-1', brief: briefA });
      db.archiveProject(proj.id, 'user-1');

      const result = db.listProjects({ userId: 'user-1' });
      expect(result.projects).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns projects in descending creation order', () => {
      db.createProject({ name: 'First', userId: 'user-1', brief: briefA });
      db.createProject({ name: 'Second', userId: 'user-1', brief: briefA });

      const result = db.listProjects({ userId: 'user-1' });
      expect(result.projects[0]?.name).toBe('Second');
      expect(result.projects[1]?.name).toBe('First');
    });
  });

  describe('updateProject', () => {
    it('updates name when userId matches', () => {
      const proj = db.createProject({ name: 'Old', userId: 'user-1', brief: briefA });
      const changed = db.updateProject(proj.id, 'user-1', { name: 'New' });
      expect(changed).toBe(true);

      const fetched = db.getProject(proj.id, 'user-1');
      expect(fetched?.name).toBe('New');
    });

    it('returns false when userId does not match', () => {
      const proj = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      const changed = db.updateProject(proj.id, 'user-2', { name: 'Hacked' });
      expect(changed).toBe(false);
    });
  });

  describe('archiveProject', () => {
    it('sets status to archived and returns true', () => {
      const proj = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      const result = db.archiveProject(proj.id, 'user-1');
      expect(result).toBe(true);

      const all = db.listProjects({ userId: 'user-1', status: 'archived' });
      expect(all.total).toBe(1);
    });

    it('returns false when userId does not match', () => {
      const proj = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      expect(db.archiveProject(proj.id, 'user-2')).toBe(false);
    });

    it('returns false when already archived', () => {
      const proj = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      db.archiveProject(proj.id, 'user-1');
      expect(db.archiveProject(proj.id, 'user-1')).toBe(false);
    });
  });

  describe('countActiveBuilds', () => {
    it('counts projects with status building', () => {
      db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      db.createProject({ name: 'B', userId: 'user-1', brief: briefA });
      expect(db.countActiveBuilds('user-1')).toBe(2);
    });

    it('does not count preview or other statuses', () => {
      const proj = db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      db.updateProjectStatus(proj.id, 'preview');
      expect(db.countActiveBuilds('user-1')).toBe(0);
    });

    it('isolates by userId', () => {
      db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      expect(db.countActiveBuilds('user-2')).toBe(0);
    });
  });

  describe('countUserProjects', () => {
    it('counts non-archived projects', () => {
      db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      db.createProject({ name: 'B', userId: 'user-1', brief: briefA });
      expect(db.countUserProjects('user-1')).toBe(2);
    });

    it('excludes archived from count', () => {
      const proj = db.createProject({ name: 'A', userId: 'user-1', brief: briefA });
      db.archiveProject(proj.id, 'user-1');
      expect(db.countUserProjects('user-1')).toBe(0);
    });
  });

  describe('createBillingEvent', () => {
    it('inserts billing event without error', () => {
      const proj = db.createProject({ name: 'Site', userId: 'user-1', brief: briefA });
      expect(() => {
        db.createBillingEvent({
          projectId: proj.id,
          userId: 'user-1',
          eventType: 'website.build.completed',
          quantity: 1,
        });
      }).not.toThrow();
    });
  });
});
