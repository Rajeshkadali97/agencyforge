import { Agent, AgentHealth } from '../types';
import { IAgentRegistry } from '../interfaces/IAgentRegistry';

export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, Agent> = new Map();

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.agent_id, agent);
  }

  public unregisterAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  public getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  public listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public listAgentsByCapability(capability: string): Agent[] {
    return this.listAgents().filter((agent) =>
      agent.capabilities.some((cap) => cap.name === capability)
    );
  }

  public healthCheck(agentId: string): AgentHealth {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.health;
  }

  public status(agentId: string): string {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.status;
  }

  public capabilities(agentId: string): string[] {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.capabilities.map((c) => c.name);
  }

  public memoryScope(agentId: string): string | undefined {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.memory_scope;
  }

  public permissions(agentId: string): string[] {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.permissions ?? [];
  }

  public version(agentId: string): string {
    const agent = this.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    return agent.version;
  }
}
