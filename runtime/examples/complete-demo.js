"use strict";

const { Configuration } = require('./dist/config');
const { ConsoleLogger } = require('./dist/utils/ConsoleLogger');
const { EnhancedEventBus } = require('./dist/events/EnhancedEventBus');
const { DataService } = require('./dist/services/DataService');
const { AIService } = require('./dist/ai/ai-service');
const { createProviderFactory } = require('./dist/ai/provider-factory');
const { MemoryBinding } = require('./dist/bindings/memory/MemoryBinding');
const { AgentRegistry } = require('./dist/agent/AgentRegistry');
const path = require('path');
const { ExecutionContextFactory, ContextRegistry } = require('./dist/context/ExecutionContextFactory');
const { DashboardBinding } = require('./dist/bindings/dashboard/DashboardBinding');
const { ObservabilityService } = require('./dist/observability');
const { WorkflowEngine } = require('./dist/workflow/WorkflowEngineImpl');
const { InMemoryWorkflowStore } = require('./dist/workflow/WorkflowEngine');
const { HealthServer } = require('./dist/health/HealthServer');
const { HealthManager } = require('./dist/health/HealthManager');
const { ModelRouter } = require('./dist/model-routing/ModelRouter');

(async () => {
    // Core initialization
    const config = new Configuration({
        providers: {
            ollama: { enabled: true, priority: 1, models: ['llama3', 'mistral'] },
            openrouter: { enabled: true, priority: 2, models: ['gpt-4', 'claude-3'] },
            gemini: { enabled: true, priority: 3, models: ['gemini-pro'] }
        }
    });
    const logger = new ConsoleLogger(config);
    const eventBus = new EnhancedEventBus(logger);

    // Dashboard binding
    const dashboard = new DashboardBinding(eventBus, logger, { enableBriefings: true });
    await dashboard.initialize();
    dashboard.subscribeToState(state => {
        console.log('[DASHBOARD STATE UPDATE]', {
            notifications: state.notifications.length,
            activities: state.activities.length
        });
    });

    // Health server
    const healthManager = new HealthManager(logger);
    const healthServer = new HealthServer(healthManager, logger);
    healthServer.start();

    // Observability
    const observability = new ObservabilityService(eventBus, logger);
    await observability.initialize();
    observability.registerHealthCheck('runtime', async () => ({
        healthy: true,
        message: 'All systems operational'
    }));

    // Demo data & AI
    const dataService = new DataService(eventBus, logger, config);
    const providerFactory = createProviderFactory();
    const aiService = new AIService(providerFactory);
    const modelRouter = new ModelRouter(logger, config);

    // Memory & persistence
    const memoryBinding = new MemoryBinding(eventBus, logger, {});
    await memoryBinding.initialize();

    // Agent registry & discovery
    const agentRegistry = new AgentRegistry({
        discoveryPaths: [path.join(__dirname, 'agents')]
    }, logger, eventBus);
    await agentRegistry.initialize();
    console.log('[AGENT DISCOVERY]', agentRegistry.listDefinitions().map(d => d.id));

    // Instantiate concrete agents
    const { ResearchAgent, RevenueAgent } = require('./dist/agent/impl/ResearchAgent');
    const researchAgent = new ResearchAgent(logger, eventBus, dataService, aiService);
    const revenueAgent = new RevenueAgent(logger, eventBus, dataService, aiService);

    // Create execution context for agent initialization
    const contextRegistry = new ContextRegistry();
    const execContextFactory = new ExecutionContextFactory(contextRegistry);
    const initContext = execContextFactory.createContext({
        workflowId: 'wf_init',
        taskId: 'task_init',
        userId: 'demo_user',
        projectId: 'demo_project',
        logger,
        config,
        eventBus,
    });

    // Initialize agents
    await researchAgent.initialize(initContext);
    await revenueAgent.initialize(initContext);

    // Register agents with the registry (for legacy lookup)
    agentRegistry.register(researchAgent);
    agentRegistry.register(revenueAgent);

    // Workflow engine
    const workflowStore = new InMemoryWorkflowStore();
    const workflowEngine = new WorkflowEngine(workflowStore, eventBus, logger);

    // Execution context factory
    const createContext = () => {
        const traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        return execContextFactory.createContext({
            workflowId: `wf_${Date.now()}`,
            taskId: `task_${Date.now()}`,
            userId: 'demo_user',
            projectId: 'demo_project',
            traceId,
            logger,
            config,
            eventBus,
        });
    };

    // Subscribe to major events
    eventBus.subscribe('*', event => {
        logger.debug(`[EVENT] ${event.type}`, {
            traceId: event.traceId,
            spanId: event.spanId,
            payload: event.payload
        });
    });

    // Planner Demo: Goal -> Workflow
    console.log('\n=== PLANNER DEMO ===');
    const goal = 'Find dentists in Dallas and generate a revenue proposal for the top candidate';
    console.log('Goal:', goal);

    // Workflow Definition (generated by planner in a real system)
    const workflowDefinition = {
        id: 'demo-workflow-deal-generation',
        name: 'Deal Generation Workflow',
        version: '1.0',
        steps: [
            {
                id: 'research-step',
                name: 'Market Research',
                type: 'sequential',
                execute: async (ctx) => {
                    console.log('[STEP] Executing research-step with researchAgent');
                    const result = await researchAgent.execute(ctx, {
                        query: 'dentist in Dallas',
                        depth: 'basic'
                    });
                    return {
                        success: result.success,
                        output: result.output,
                    };
                },
                dependencies: [],
                retryPolicy: { maxRetries: 2, baseDelayMs: 100 }
            },
            {
                id: 'score-step',
                name: 'Lead Scoring',
                type: 'sequential',
                execute: async (ctx) => {
                    console.log('[STEP] Executing score-step with revenueAgent');
                    const researchExec = workflowEngine.getExecution(ctx.workflowId);
                    const researchOutput = researchExec?.stepResults.get('research-step')?.output;
                    const firstBiz = researchOutput?.results?.[0]?.business?.name || 'Example Dentist';

                    const result = await revenueAgent.execute(ctx, {
                        action: 'score-lead',
                        data: { businessName: firstBiz }
                    });
                    return {
                        success: result.success,
                        output: result.output,
                    };
                },
                dependencies: ['research-step']
            },
            {
                id: 'proposal-step',
                name: 'Proposal Generation',
                type: 'sequential',
                execute: async (ctx) => {
                    console.log('[STEP] Executing proposal-step with revenueAgent');
                    const workflowExec = workflowEngine.getExecution(ctx.workflowId);
                    const researchOutput = workflowExec?.stepResults.get('research-step')?.output;
                    const scoreOutput = workflowExec?.stepResults.get('score-step')?.output;

                    const firstBiz = researchOutput?.results?.[0]?.business || {
                        name: 'Example Dentist',
                        industry: 'Dental',
                        employeeCount: 10,
                        revenue: '$1M'
                    };

                    const result = await revenueAgent.execute(ctx, {
                        action: 'generate-proposal',
                        data: {
                            lead: {
                                id: scoreOutput?.id || 'lead_unknown',
                                business: scoreOutput?.business || firstBiz
                            }
                        }
                    });
                    return {
                        success: result.success,
                        output: result.output,
                    };
                },
                dependencies: ['score-step']
            }
        ]
    };

    // Execute workflow
    console.log('\n=== WORKFLOW EXECUTION ===');
    const workflowCtx = createContext();
    const execution = await workflowEngine.execute(workflowDefinition, workflowCtx);
    console.log('Workflow status:', execution.status);
    console.log('Step metrics:', execution.stepMetrics);

    const stepResults = {};
    for (const [key, value] of execution.stepResults) {
        stepResults[key] = value;
    }
    console.log('Step results:', JSON.stringify(stepResults, null, 2));

    // Memory persistence & dashboard snapshot
    console.log('\n=== MEMORY PERSISTENCE & DASHBOARD SNAPSHOT ===');
    const memoryState = memoryBinding.getFullState();
    console.log('Memory state keys:', Object.keys(memoryState));

    console.log('\nDashboard state:', dashboard.getState());

    // AI Provider Routing Demo
    console.log('\n=== AI PROVIDER ROUTING ===');
    let aiResponseContent = 'No providers configured';
    try {
        const model = 'llama3';
        const provider = modelRouter.getProviderForModel(model);
        console.log(`Model ${model} routed to provider: ${provider}`);

        const response = await aiService.complete([
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say hello.' }
        ], {
            modelId: model,
            maxTokens: 20
        });
        aiResponseContent = response.content;
        console.log('AI response:', response.content);
    } catch (err) {
        console.log('AI routing result:', err.message || 'No providers available');
        aiResponseContent = `Routing attempted (${err.message})`;
    }

    // Health endpoint check
    console.log('\n=== HEALTH ENDPOINT CHECK ===');
    const healthResponse = await new Promise((resolve) => {
        require('http').get('http://localhost:3002/health', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', (err) => {
            console.error('Health check failed:', err.message);
            resolve({ error: err.message });
        });
    });
    console.log('Health check response:', healthResponse);

    // Observability snapshot
    console.log('\n=== OBSERVABILITY SNAPSHOT ===');
    const snapshot = observability.getSnapshot();
    console.log('Metrics count:', snapshot.metrics.length);
    console.log('Active traces:', snapshot.activeTraces);
    console.log('Recent events logged:', snapshot.recentLogs.length);

    // Final response
    console.log('\n=== FINAL DEMO OUTPUT ===');
    const finalOutput = {
        goal,
        workflowStatus: execution.status,
        workflowId: execution.workflowId,
        researchOutput: stepResults['research-step']?.success ? 'completed' : 'failed',
        scoreOutput: stepResults['score-step']?.success ? 'completed' : 'failed',
        proposalOutput: stepResults['proposal-step']?.success ? 'completed' : 'failed',
        memoryPersisted: !!Object.keys(memoryState).length,
        memoryKeys: Object.keys(memoryState),
        dashboardEvents: dashboard.getActivities().length,
        dashboardNotifications: dashboard.getNotifications().length,
        healthStatus: healthResponse.overall,
        observabilityMetrics: snapshot.metrics.length,
        observabilityTraces: snapshot.activeTraces,
        aiRoutingAttempted: aiResponseContent
    };
    console.log(JSON.stringify(finalOutput, null, 2));

    // Cleanup
    await researchAgent.dispose();
    await revenueAgent.dispose();
    await dashboard.shutdown();
    await memoryBinding.shutdown();
    await observability.shutdown();
    await healthServer.stop();
    console.log('\n=== DEMO COMPLETE ===');
})().catch(console.error);