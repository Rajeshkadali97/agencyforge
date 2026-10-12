import { createResearchEngine } from './index';

// Test the research engine with deterministic mock providers
async function testResearchEngine() {
  console.log('Testing Research Engine...');
  
  try {
    const engine = createResearchEngine();
    
    // Test basic company discovery
    const request = {
      company_name: 'Test Company',
      domain: 'testcompany.com',
      industry: 'Technology',
      location: 'San Francisco',
      depth: 'standard' as const,
      include_competitors: true,
      include_tech_stack: true,
      include_seo: true
    };
    
    console.log('Running research request:', JSON.stringify(request, null, 2));
    
    const report = await engine.research(request);
    
    console.log('Research Report:');
    console.log(JSON.stringify(report, null, 2));
    
    // Validate the structure
    if (!report.request) {
      throw new Error('Missing request in report');
    }
    
    if (!report.generated_at) {
      throw new Error('Missing generated_at in report');
    }
    
    if (!Array.isArray(report.overall_insights)) {
      throw new Error('Overall insights should be an array');
    }
    
    if (!Array.isArray(report.priority_actions)) {
      throw new Error('Priority actions should be an array');
    }
    
    console.log('✓ Basic research test passed');
    
    // Test with just domain
    const domainRequest = {
      domain: 'example.com',
      depth: 'basic' as const
    };
    
    const domainReport = await engine.research(domainRequest);
    console.log('Domain-only research completed');
    console.log('Company profile:', domainReport.company_profile?.name || 'None');
    
    // Test with just company name
    const companyRequest = {
      company_name: 'Another Company',
      depth: 'deep' as const
    };
    
    const companyReport = await engine.research(companyRequest);
    console.log('Company-only research completed');
    console.log('Company profile:', companyReport.company_profile?.name || 'None');
    
    console.log('All tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

// Run the test
testResearchEngine()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });