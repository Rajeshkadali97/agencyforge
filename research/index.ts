export * from './shared/interfaces';
export * from './shared/types';
import { ResearchEngine } from './engine';
export { ResearchEngine };

// Provider-based implementation
import { providerRegistry } from './providers/registry';
import { 
  MockCompanyDiscoveryProvider 
} from './providers/company_discovery/mock';
import { 
  MockWebsiteAnalysisProvider 
} from './providers/website_analysis/mock';
import { 
  MockTechnologyDetectionProvider 
} from './providers/technology_detection/mock';
import { 
  MockSEOAnalysisProvider 
} from './providers/seo_analysis/mock';
import { 
  MockCompetitorAnalysisProvider 
} from './providers/competitor_analysis/mock';
import { 
  CompanyDiscoveryAdapter 
} from './adapters/company-discovery.adapter';
import { 
  WebsiteAnalysisAdapter 
} from './adapters/website-analysis.adapter';
import { 
  TechnologyDetectionAdapter 
} from './adapters/technology-detection.adapter';
import { 
  SEOAnalysisAdapter 
} from './adapters/seo-analysis.adapter';
import { 
  CompetitorAnalysisAdapter 
} from './adapters/competitor-analysis.adapter';
import { ICompanyDiscovery, IWebsiteAnalysis, ITechnologyDetection, ISEOAnalysis, ICompetitorAnalysis } from './shared/interfaces';

// Register all mock providers
providerRegistry.registerCompanyDiscovery(new MockCompanyDiscoveryProvider());
providerRegistry.registerWebsiteAnalysis(new MockWebsiteAnalysisProvider());
providerRegistry.registerTechnologyDetection(new MockTechnologyDetectionProvider());
providerRegistry.registerSEOAnalysis(new MockSEOAnalysisProvider());
providerRegistry.registerCompetitorAnalysis(new MockCompetitorAnalysisProvider());

// Create adapters using the registered providers
const companyDiscoveryAdapter = new CompanyDiscoveryAdapter(
  providerRegistry.getCompanyDiscoveryProviders()[0]
);
const websiteAnalysisAdapter = new WebsiteAnalysisAdapter(
  providerRegistry.getWebsiteAnalysisProviders()[0]
);
const technologyDetectionAdapter = new TechnologyDetectionAdapter(
  providerRegistry.getTechnologyDetectionProviders()[0]
);
const seoAnalysisAdapter = new SEOAnalysisAdapter(
  providerRegistry.getSEOAnalysisProviders()[0]
);
const competitorAnalysisAdapter = new CompetitorAnalysisAdapter(
  providerRegistry.getCompetitorAnalysisProviders()[0]
);

/**
 * Creates a research engine using mock providers via the provider registry
 * This ensures deterministic outputs for testing and development
 */
export function createResearchEngine(): ResearchEngine {
  return new ResearchEngine(
    companyDiscoveryAdapter,
    websiteAnalysisAdapter,
    competitorAnalysisAdapter,
    technologyDetectionAdapter,
    seoAnalysisAdapter
  );
}