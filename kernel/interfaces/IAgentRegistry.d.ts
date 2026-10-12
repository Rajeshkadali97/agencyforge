import { Agent, AgentHealth } from '../types';
export interface IAgentRegistry {
    registerAgent(agent: Agent): void;
    unregisterAgent(agentId: string): boolean;
    getAgent(agentId: string): Agent | undefined;
    listAgents(): Agent[];
    listAgentsByCapability(capability: string): Agent[];
    /** Required specific methods */
    healthCheck(agentId: string): AgentHealth;
    status(agentId: string): string;
    capabilities(agentId: string): string[];
    memoryScope(agentId: string): string | undefined;
    permissions(agentId: string): string[];
    version(agentId: string): string;
}
//# sourceMappingURL=IAgentRegistry.d.ts.map