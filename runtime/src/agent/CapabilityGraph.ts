import { CapabilityGraph, CapabilityGraphNode, AgentCapability, WorkflowTag, AgentDefinition } from './AgentDefinition';

export class CapabilityGraphBuilder {
  private nodes: Map<string, CapabilityGraphNode> = new Map();
  private edges: Array<{ from: string; to: string; type: 'depends_on' | 'enables' | 'conflicts_with' }> = [];

  buildFromAgents(agents: AgentDefinition[]): CapabilityGraph {
    this.nodes.clear();
    this.edges = [];

    for (const agent of agents) {
      for (const capability of agent.capabilities) {
        this.addOrUpdateNode(capability.name, agent.id, capability, agent.workflowTags);
      }

      for (const dependency of agent.dependencies) {
        if (dependency.capability) {
          this.edges.push({
            from: agent.id,
            to: dependency.agentId,
            type: dependency.relationship === 'fallback' ? 'conflicts_with' : 'depends_on',
          });
        }
      }

      for (const skill of agent.skills) {
        for (const capName of skill.capabilities) {
          const node = this.nodes.get(capName);
          if (node) {
            if (!node.agents.includes(agent.id)) {
              node.agents.push(agent.id);
            }
          }
        }
      }
    }

    this.calculateComplexity();
    this.buildTransitiveEdges();

    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  private addOrUpdateNode(
    capabilityName: string,
    agentId: string,
    capability: AgentCapability,
    workflowTags: WorkflowTag[]
  ): void {
    let node = this.nodes.get(capabilityName);

    if (!node) {
      node = {
        capability: capabilityName,
        agents: [agentId],
        dependencies: [],
        dependents: [],
        workflowTags: workflowTags.map((t) => t.tag),
        complexity: 0,
      };
      this.nodes.set(capabilityName, node);
    } else {
      if (!node.agents.includes(agentId)) {
        node.agents.push(agentId);
      }
      for (const tag of workflowTags) {
        if (!node.workflowTags.includes(tag.tag)) {
          node.workflowTags.push(tag.tag);
        }
      }
    }
  }

  private calculateComplexity(): void {
    for (const node of this.nodes.values()) {
      let complexity = 0;
      complexity += node.agents.length * 0.5;
      complexity += node.dependencies.length * 1;
      complexity += node.dependents.length * 1;
      complexity += node.workflowTags.length * 0.3;
      node.complexity = Math.min(10, Math.round(complexity * 10) / 10);
    }
  }

  private buildTransitiveEdges(): void {
    for (const node of this.nodes.values()) {
      for (const dep of node.dependencies) {
        const depNode = this.nodes.get(dep);
        if (depNode && !depNode.dependents.includes(node.capability)) {
          depNode.dependents.push(node.capability);
        }
      }
    }
  }

  getGraph(): CapabilityGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  findCapabilitiesByWorkflowTag(tag: string): string[] {
    const result: string[] = [];
    for (const node of this.nodes.values()) {
      if (node.workflowTags.includes(tag)) {
        result.push(node.capability);
      }
    }
    return result;
  }

  findAgentsForCapabilities(capabilities: string[]): string[] {
    const agentSet = new Set<string>();
    for (const cap of capabilities) {
      const node = this.nodes.get(cap);
      if (node) {
        for (const agentId of node.agents) {
          agentSet.add(agentId);
        }
      }
    }
    return Array.from(agentSet);
  }

  getExecutionOrder(capabilities: string[]): string[][] {
    const subgraph = new Map<string, CapabilityGraphNode>();
    const visited = new Set<string>();

    for (const cap of capabilities) {
      this.collectSubgraph(cap, subgraph, visited);
    }

    const levels: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < subgraph.size) {
      const currentLevel: string[] = [];
      for (const [cap, node] of subgraph) {
        if (processed.has(cap)) continue;
        const depsMet = node.dependencies.every((d) => processed.has(d) || !subgraph.has(d));
        if (depsMet) {
          currentLevel.push(cap);
        }
      }

      if (currentLevel.length === 0) {
        const remaining = Array.from(subgraph.keys()).filter((c) => !processed.has(c));
        if (remaining.length > 0) {
          levels.push(remaining);
          for (const c of remaining) processed.add(c);
        }
        break;
      }

      for (const cap of currentLevel) {
        processed.add(cap);
      }
      levels.push(currentLevel);
    }

    return levels;
  }

  private collectSubgraph(capability: string, subgraph: Map<string, CapabilityGraphNode>, visited: Set<string>): void {
    if (visited.has(capability)) return;
    visited.add(capability);

    const node = this.nodes.get(capability);
    if (!node) return;

    subgraph.set(capability, node);

    for (const dep of node.dependencies) {
      this.collectSubgraph(dep, subgraph, visited);
    }
    for (const dep of node.dependents) {
      this.collectSubgraph(dep, subgraph, visited);
    }
  }

  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (cap: string): boolean => {
      visited.add(cap);
      recStack.add(cap);
      path.push(cap);

      const node = this.nodes.get(cap);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true;
          } else if (recStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            cycles.push(path.slice(cycleStart));
            return true;
          }
        }
      }

      recStack.delete(cap);
      path.pop();
      return false;
    };

    for (const cap of this.nodes.keys()) {
      if (!visited.has(cap)) {
        dfs(cap);
      }
    }

    return cycles;
  }

  getStats(): { nodeCount: number; edgeCount: number; avgComplexity: number; cycles: number } {
    let totalComplexity = 0;
    for (const node of this.nodes.values()) {
      totalComplexity += node.complexity;
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      avgComplexity: this.nodes.size > 0 ? totalComplexity / this.nodes.size : 0,
      cycles: this.detectCycles().length,
    };
  }
}

export class CapabilityRouter {
  private graph: CapabilityGraph;

  constructor(graph: CapabilityGraph) {
    this.graph = graph;
  }

  route(capabilities: string[], constraints?: {
    maxCost?: number;
    maxLatencyMs?: number;
    preferredProviders?: string[];
    requiredTools?: string[];
  }): {
    executionPlan: Array<{ capability: string; agents: string[]; parallel: boolean }>;
    estimatedCost: number;
    estimatedLatencyMs: number;
    warnings: string[];
  } {
    const executionOrder = this.getExecutionOrder(capabilities);
    const warnings: string[] = [];
    let totalCost = 0;
    let totalLatency = 0;

    const executionPlan = executionOrder.map((level) => {
      const levelAgents = new Set<string>();
      let levelCost = 0;
      let levelLatency = 0;

      for (const cap of level) {
        const node = this.graph.nodes.get(cap);
        if (node) {
          for (const agentId of node.agents) {
            levelAgents.add(agentId);
          }
          levelCost += node.complexity * 0.01;
          levelLatency = Math.max(levelLatency, node.complexity * 100);
        }
      }

      totalCost += levelCost;
      totalLatency += levelLatency;

      return {
        capability: level.join(', '),
        agents: Array.from(levelAgents),
        parallel: level.length > 1,
      };
    });

    if (constraints?.maxCost && totalCost > constraints.maxCost) {
      warnings.push(`Estimated cost ${totalCost.toFixed(4)} exceeds limit ${constraints.maxCost}`);
    }
    if (constraints?.maxLatencyMs && totalLatency > constraints.maxLatencyMs) {
      warnings.push(`Estimated latency ${totalLatency}ms exceeds limit ${constraints.maxLatencyMs}ms`);
    }

    return {
      executionPlan,
      estimatedCost: totalCost,
      estimatedLatencyMs: totalLatency,
      warnings,
    };
  }

  private getExecutionOrder(capabilities: string[]): string[][] {
    const subgraph = new Map<string, CapabilityGraphNode>();
    const visited = new Set<string>();

    for (const cap of capabilities) {
      this.collectSubgraph(cap, subgraph, visited);
    }

    const levels: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < subgraph.size) {
      const currentLevel: string[] = [];
      for (const [cap, node] of subgraph) {
        if (processed.has(cap)) continue;
        const depsMet = node.dependencies.every((d) => processed.has(d) || !subgraph.has(d));
        if (depsMet) {
          currentLevel.push(cap);
        }
      }

      if (currentLevel.length === 0) {
        const remaining = Array.from(subgraph.keys()).filter((c) => !processed.has(c));
        if (remaining.length > 0) {
          break;
      }
      }

      for (const cap of currentLevel) {
        processed.add(cap);
      }
      levels.push(currentLevel);
    }

    return levels;
  }

  private collectSubgraph(capability: string, subgraph: Map<string, CapabilityGraphNode>, visited: Set<string>): void {
    if (visited.has(capability)) return;
    visited.add(capability);

    const node = this.graph.nodes.get(capability);
    if (!node) return;

    subgraph.set(capability, node);

    for (const dep of node.dependencies) {
      this.collectSubgraph(dep, subgraph, visited);
    }
    for (const dep of node.dependents) {
      this.collectSubgraph(dep, subgraph, visited);
    }
  }
}