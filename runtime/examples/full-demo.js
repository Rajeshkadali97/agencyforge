const { Configuration } = require('./dist/config');
const { ConsoleLogger } = require('./dist/utils/ConsoleLogger');
const { EnhancedEventBus } = require('./dist/events/EnhancedEventBus');
const { DataService } = require('./dist/services/DataService');
const { AIService } = require('./dist/ai/ai-service');
const { createProviderFactory } = require('./dist/ai/provider-factory');
const { MemoryBinding } = require('./dist/bindings/memory/MemoryBinding');
const { AgentRegistry } = require('./dist/agent/AgentRegistry');
const path = require('path');
const { ResearchAgent, RevenueAgent } = require('./dist/agent/impl/ResearchAgent');
console.log('Running from __dirname:', __dirname);
const { ContextRegistry, ExecutionContextFactory } = require('./dist/context/ExecutionContextFactory');

(async () => {
  // Core components
  const logger = new ConsoleLogger(new Configuration());
  const eventBus = new EnhancedEventBus(logger);
  const config = new Configuration();

  // Memory binding (for persistence)
  const memoryBinding = new MemoryBinding(eventBus, logger, {});
  await memoryBinding.initialize();

  // Data service (provides mock business data)
  const dataService = new DataService(eventBus, logger, config);

  // AI Service (with mock fallback provider)
  const providerFactory = createProviderFactory();
  const aiService = new AIService(providerFactory);

  // Execution context factory (shared across agents)
  const contextRegistry = new ContextRegistry();
  const execContextFactory = new ExecutionContextFactory(contextRegistry);
  const createContext = () => {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    return execContextFactory.createContext({
      workflowId,
      taskId,
      userId: 'demo_user',
      projectId: 'demo_project',
      memoryScope: undefined,
      logger,
      config,
      eventBus,
    });
  };

  // Subscribe to live events (dashboard simulation)
  eventBus.subscribe('*', (e) => console.log(`[EVENT] ${e.type}`));

  // Agent registry (auto-discover JSON definitions under ./agents)
  const agentRegistry = new AgentRegistry({ discoveryPaths: [path.join(__dirname, 'agents')] }, logger, eventBus);
  await agentRegistry.initialize(); // performs discovery and builds capability graph
  console.log('Discovered definitions:', agentRegistry.listDefinitions().map(d => d.id));

  // Capability lookup demo
  const researchByCap = agentRegistry.findByCapability('research');
  console.log('Agents with "research" capability:', researchByCap.map(a => a.metadata.id));

  // Instantiate concrete agents
const researchAgent = new ResearchAgent(logger, eventBus, dataService, aiService);
const revenueAgent = new RevenueAgent(logger, eventBus, dataService, aiService);
// Register agents with the registry
agentRegistry.register(researchAgent);
agentRegistry.register(revenueAgent);
// Initialise agents with a shared context
const initContext = createContext();
await researchAgent.initialize(initContext);
await revenueAgent.initialize(initContext);

  // ----- Planner (mock) -----
  const userGoal = { objective: 'Find dentists in Dallas' };
  console.log('\n=== User Request ===');
  console.log(userGoal.objective);

  // ----- Research Agent -----
  console.log('\n=== Research Agent Execution ===');
  const researchCtx = createContext();
  const researchResult = await researchAgent.execute(researchCtx, { query: 'dentist', depth: 'basic' });
  console.log('Research success:', researchResult.success);
  console.log('Businesses found:', researchResult.output?.businessesFound);
  memoryBinding.store('research.result', researchResult.output, 'global');

  // ----- Revenue Agent: Lead Scoring -----
  console.log('\n=== Revenue Agent Execution (Lead Scoring) ===');
  const firstBiz = researchResult.output?.results?.[0]?.business?.name || 'Example Business';
  const scoreCtx = createContext();
  const scoreResult = await revenueAgent.execute(scoreCtx, { action: 'score-lead', data: { businessName: firstBiz } });
  console.log('Lead scoring success:', scoreResult.success);
  if (scoreResult.success) memoryBinding.store('lead.scored', scoreResult.output, 'global');

  // ----- Revenue Agent: Proposal Generation -----
  console.log('\n=== Revenue Agent Execution (Proposal Generation) ===');
  const proposalCtx = createContext();
  const proposalResult = await revenueAgent.execute(proposalCtx, {
    action: 'generate-proposal',
    data: { lead: { business: { name: firstBiz, industry: 'Dental', employeeCount: 20, revenue: '$5M', technology: [] } } },
  });
  console.log('Proposal generation success:', proposalResult.success);
  if (proposalResult.success) memoryBinding.store('proposal.generated', proposalResult.output, 'global');

  // ----- Dashboard Snapshot (Memory) -----
  console.log('\n=== Dashboard Snapshot (Memory) ===');
  console.log(JSON.stringify(memoryBinding.getFullState(), null, 2));

  // ----- Memory Persistence Test -----
  const persistedState = memoryBinding.getFullState();
  await memoryBinding.shutdown();

  const memoryBinding2 = new MemoryBinding(eventBus, logger, {});
  await memoryBinding2.initialize();
  memoryBinding2.restoreState(persistedState);
  console.log('\n=== After Restart – Memory Restored ===');
  console.log(JSON.stringify(memoryBinding2.getFullState(), null, 2));

  // ----- AI Provider Routing Fallback Demo -----
  console.log('\n=== AI Provider Routing Fallback Demo ===');
  try {
    const simpleMessage = [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'Say hello.' }];
    const response = await aiService.complete(simpleMessage, { forceProvider: 'nonexistent', preferredProvider: 'ollama', maxTokens: 10 });
    console.log('AI Service returned via fallback provider:', response.content);
  } catch (err) {
    console.error('AI Service failed:', err.message);
  }

  // ----- Hot Reload Demo -----
  console.log('\n=== Hot Reload Demo ===');
  // Trigger a re-discovery after the earlier definition edit that added a new capability
  await agentRegistry.discoverAgents();
  const analysisAgents = agentRegistry.findByCapability('analysis');
  console.log('Agents with new "analysis" capability after hot reload:', analysisAgents.map(a => a.metadata.id));

  // Cleanup
  await researchAgent.dispose();
  await revenueAgent.dispose();
  await memoryBinding2.shutdown();
  console.log('\nDemo completed successfully.');
})();
