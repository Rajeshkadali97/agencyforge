import { describe, it, expect } from 'vitest';
import { DataService } from '../services/DataService';
import { ConsoleLogger } from '../utils/ConsoleLogger';
import { Configuration } from '../config';
import { EnhancedEventBus } from '../events/EnhancedEventBus';

describe('DataService', () => {
  let dataService: DataService;
  let logger: ConsoleLogger;
  let eventBus: EnhancedEventBus;

  beforeEach(() => {
    const config = new Configuration({ logging: { level: 'ERROR' } });
    logger = new ConsoleLogger(config);
    eventBus = new EnhancedEventBus(logger);
    dataService = new DataService(eventBus, logger, config);
  });

  describe('getBusinesses', () => {
    it('should return businesses for a query', async () => {
      const businesses = await dataService.getBusinesses('dental', 5);

      expect(businesses).toBeDefined();
      expect(Array.isArray(businesses)).toBe(true);
      expect(businesses.length).toBeGreaterThan(0);
      expect(businesses.length).toBeLessThanOrEqual(5);

      const business = businesses[0];
      expect(business.id).toBeDefined();
      expect(business.name).toBeDefined();
      expect(business.domain).toBeDefined();
      expect(business.location).toBeDefined();
    });

    it('should return businesses when queried with different terms', async () => {
      const dentalBusinesses = await dataService.getBusinesses('dental', 3);
      const medicalBusinesses = await dataService.getBusinesses('medical', 3);

      expect(dentalBusinesses).toBeDefined();
      expect(medicalBusinesses).toBeDefined();
      expect(dentalBusinesses.length).toBeGreaterThan(0);
      expect(medicalBusinesses.length).toBeGreaterThan(0);
    });
  });

  describe('scoreLead', () => {
    it('should return a scored lead', async () => {
      const businesses = await dataService.getBusinesses('restaurant', 1);
      const business = businesses[0];

      const lead = await dataService.scoreLead(business);

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.score).toBeGreaterThanOrEqual(0);
      expect(lead.score).toBeLessThanOrEqual(100);
      expect(lead.tier).toMatch(/^(hot|warm|cold)$/);
      expect(lead.factors).toBeDefined();
      expect(Array.isArray(lead.factors)).toBe(true);
      expect(lead.business).toEqual(business);
    });

    it('should emit lead.scored event', async () => {
      const businesses = await dataService.getBusinesses('retail', 1);
      const business = businesses[0];

      let eventEmitted = false;
      const subscriptionId = eventBus.subscribe('lead.scored', () => {
        eventEmitted = true;
      });

      await dataService.scoreLead(business);

      expect(eventEmitted).toBe(true);
      eventBus.unsubscribe(subscriptionId);
    });
  });

  describe('generateProposal', () => {
    it('should return a proposal for a hot lead', async () => {
      const businesses = await dataService.getBusinesses('tech startup', 1);
      const business = businesses[0];
      const lead = await dataService.scoreLead(business);

      const proposal = await dataService.generateProposal(lead);

      expect(proposal).toBeDefined();
      expect(proposal.id).toBeDefined();
      expect(proposal.leadId).toBe(lead.id);
      expect(proposal.clientName).toBe(business.name);
      expect(proposal.sections).toBeDefined();
      expect(Array.isArray(proposal.sections)).toBe(true);
      expect(proposal.sections.length).toBeGreaterThan(0);
    });

    it('should emit proposal.generated event', async () => {
      const businesses = await dataService.getBusinesses('consulting', 1);
      const business = businesses[0];
      const lead = await dataService.scoreLead(business);

      let eventEmitted = false;
      const subscriptionId = eventBus.subscribe('proposal.generated', () => {
        eventEmitted = true;
      });

      await dataService.generateProposal(lead);

      expect(eventEmitted).toBe(true);
      eventBus.unsubscribe(subscriptionId);
    });
  });

  describe('generateResearchReport', () => {
    it('should return a research report', async () => {
      const businesses = await dataService.getBusinesses('law firm', 1);
      const business = businesses[0];

      const report = await dataService.generateResearchReport(business);

      expect(report).toBeDefined();
      expect(report.companyProfile).toBeDefined();
      expect(report.websiteAnalysis).toBeDefined();
      expect(report.technologyDetection).toBeDefined();
      expect(report.seoAnalysis).toBeDefined();
      expect(report.overallInsights).toBeDefined();
      expect(report.priorityActions).toBeDefined();
    });
  });

  describe('getWebsiteAuditResult', () => {
    it('should return a website audit result', async () => {
      const businesses = await dataService.getBusinesses('restaurant', 1);
      const business = businesses[0];

      const audit = await dataService.getWebsiteAuditResult(business);

      expect(audit).toBeDefined();
      expect(audit.overallScore).toBeGreaterThanOrEqual(0);
      expect(audit.overallScore).toBeLessThanOrEqual(100);
      expect(audit.findings).toBeDefined();
      expect(Array.isArray(audit.findings)).toBe(true);
      expect(audit.opportunities).toBeDefined();
      expect(Array.isArray(audit.opportunities)).toBe(true);
    });
  });
});