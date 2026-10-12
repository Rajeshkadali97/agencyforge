export type AgentStatus = 'registered' | 'idle' | 'assigned' | 'running' | 'paused' | 'completed' | 'failed' | 'shut_down';
export type AgentHealth = 'healthy' | 'degraded' | 'unavailable';
export interface AgentCapability {
    name: string;
    version: string;
}
export interface AgentCostProfile {
    estimated_tokens?: number;
    estimated_compute?: string;
    estimated_api_spend?: number;
}
export interface AgentLatencyProfile {
    typical_duration_ms: number;
    category: 'fast' | 'medium' | 'slow';
}
export interface AgentMetadata {
    [key: string]: unknown;
}
export interface Agent {
    /** Unique identifier (e.g., "studio.website.builder") */
    agent_id: string;
    /** Human-readable name */
    name: string;
    /** Semantic version of the agent's contract */
    version: string;
    /** Declared capabilities */
    capabilities: AgentCapability[];
    /** JSON schema for structured input */
    input_schema?: Record<string, unknown>;
    /** JSON schema for structured output */
    output_schema?: Record<string, unknown>;
    /** Estimated cost per invocation */
    cost_profile?: AgentCostProfile;
    /** Typical execution time profile */
    latency_profile?: AgentLatencyProfile;
    /** Current health status */
    health: AgentHealth;
    /** Other agent IDs or module IDs required */
    dependencies?: string[];
    /** Current lifecycle status */
    status: AgentStatus;
    /** Assigned memory scope */
    memory_scope?: string;
    /** Granted permissions */
    permissions?: string[];
    /** Extra metadata */
    metadata?: AgentMetadata;
}
//# sourceMappingURL=agent.d.ts.map