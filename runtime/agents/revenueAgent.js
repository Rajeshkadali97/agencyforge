module.exports = {
  id: 'agent.revenue',
  name: 'Revenue Agent',
  version: '1.0.0',
  capabilities: [
    { name: 'lead-scoring', version: '1.0.0', description: 'Scores business leads' },
    { name: 'proposal-generation', version: '1.0.0', description: 'Generates sales proposals' }
  ],
  skills: [],
  toolPermissions: [],
  modelPreferences: [],
  dependencies: [],
  costProfile: { estimatedCostPerExecution: 0.01, costBreakdown: {}, costOptimizationEnabled: true, preferredProviders: [] },
  memoryProfile: { scopes: [] },
  voiceProfile: { enabled: false },
  characterProfile: { displayName: 'Revenue Agent', emoji: '🤖' },
  division: 'sales',
  workflowTags: [],
};