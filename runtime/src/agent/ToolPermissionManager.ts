import { ILogger } from '../interfaces';
import { EnhancedEventBus, EventHandler } from '../events/EnhancedEventBus';
import { ToolPermission, ToolCategory, AgentDefinition } from './AgentDefinition';

export interface ToolPermissionContext {
  agentId: string;
  toolId: string;
  category: ToolCategory;
  parameters: Record<string, unknown>;
  requestId: string;
  timestamp: string;
  workflowId?: string;
  costEstimate?: number;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  cost?: number;
  durationMs: number;
  toolId: string;
  agentId: string;
}

export interface ToolPermissionRegistryInterface {
  register(tool: ToolPermissionConfig): void;
  unregister(toolId: string): boolean;
  get(toolId: string): ToolPermissionConfig | undefined;
  list(): ToolPermissionConfig[];
  findByCategory(category: ToolCategory): ToolPermissionConfig[];
}

export interface ToolPermissionConfig {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  version: string;
  parameters: ToolParameterPermissionPermission[];
  requiredPermissions: string[];
  maxRatePerSecond: number;
  timeoutMs: number;
  costPerExecution: number;
  requiresApproval: boolean;
  executable: boolean;
  executor?: (context: ToolPermissionContext) => Promise<ToolExecutionResult>;
}

export interface ToolParameterPermissionPermission {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: RegExp | ((value: unknown) => boolean);
}

export class ToolPermissionManager implements ToolPermissionRegistryInterface {
  private logger: ILogger;
  private eventBus: EnhancedEventBus;
  private tools: Map<string, ToolPermissionConfig> = new Map();
  private agentPermissions: Map<string, Map<string, ToolPermission>> = new Map();
  private executionHistory: Array<{ context: ToolPermissionContext; result: ToolExecutionResult; timestamp: Date }> = [];
  private maxHistorySize = 10000;
  private rateLimiter: Map<string, Array<number>> = new Map();
  private approvalQueue: Map<string, ToolPermissionContext> = new Map();

  constructor(logger: ILogger, eventBus: EnhancedEventBus) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.initializeDefaultTools();
  }

  private initializeDefaultTools(): void {
    const defaults: ToolPermissionConfig[] = [
      { id: 'fs.read', name: 'Read File', category: 'filesystem', description: 'Read the contents of a file', version: '1.0.0', parameters: [{ name: 'path', type: 'string', description: 'Path to the file', required: true }], requiredPermissions: ['fs.read'], maxRatePerSecond: 100, timeoutMs: 5000, costPerExecution: 0.001, requiresApproval: false, executable: true },
      { id: 'fs.write', name: 'Write File', category: 'filesystem', description: 'Write content to a file', version: '1.0.0', parameters: [{ name: 'path', type: 'string', description: 'Path to the file', required: true }, { name: 'content', type: 'string', description: 'Content to write', required: true }], requiredPermissions: ['fs.write'], maxRatePerSecond: 50, timeoutMs: 5000, costPerExecution: 0.001, requiresApproval: true, executable: true },
      { id: 'fs.delete', name: 'Delete File', category: 'filesystem', description: 'Delete a file', version: '1.0.0', parameters: [{ name: 'path', type: 'string', description: 'Path to the file', required: true }], requiredPermissions: ['fs.delete'], maxRatePerSecond: 20, timeoutMs: 5000, costPerExecution: 0.001, requiresApproval: true, executable: true },
      { id: 'browser.navigate', name: 'Navigate', category: 'browser', description: 'Navigate to a URL', version: '1.0.0', parameters: [{ name: 'url', type: 'string', description: 'URL to navigate to', required: true }], requiredPermissions: ['browser.navigate'], maxRatePerSecond: 30, timeoutMs: 30000, costPerExecution: 0.01, requiresApproval: false, executable: true },
      { id: 'browser.scrape', name: 'Scrape Page', category: 'browser', description: 'Scrape content from the current page', version: '1.0.0', parameters: [{ name: 'selector', type: 'string', description: 'CSS selector', required: false }], requiredPermissions: ['browser.scrape'], maxRatePerSecond: 20, timeoutMs: 30000, costPerExecution: 0.01, requiresApproval: false, executable: true },
      { id: 'terminal.execute', name: 'Execute Command', category: 'terminal', description: 'Execute a terminal command', version: '1.0.0', parameters: [{ name: 'command', type: 'string', description: 'Command to execute', required: true }, { name: 'cwd', type: 'string', description: 'Working directory', required: false }], requiredPermissions: ['terminal.execute'], maxRatePerSecond: 10, timeoutMs: 60000, costPerExecution: 0.005, requiresApproval: true, executable: true },
      { id: 'github.clone', name: 'Clone Repository', category: 'github', description: 'Clone a GitHub repository', version: '1.0.0', parameters: [{ name: 'url', type: 'string', description: 'Repository URL', required: true }, { name: 'branch', type: 'string', description: 'Branch to clone', required: false }], requiredPermissions: ['github.clone'], maxRatePerSecond: 5, timeoutMs: 120000, costPerExecution: 0.02, requiresApproval: true, executable: true },
      { id: 'db.query', name: 'Database Query', category: 'database', description: 'Execute a database query', version: '1.0.0', parameters: [{ name: 'sql', type: 'string', description: 'SQL query', required: true }, { name: 'parameters', type: 'array', description: 'Query parameters', required: false }], requiredPermissions: ['db.query'], maxRatePerSecond: 100, timeoutMs: 10000, costPerExecution: 0.005, requiresApproval: false, executable: true },
      { id: 'api.request', name: 'API Request', category: 'api', description: 'Make an HTTP request', version: '1.0.0', parameters: [{ name: 'method', type: 'string', description: 'HTTP method', required: true }, { name: 'url', type: 'string', description: 'Request URL', required: true }, { name: 'body', type: 'object', description: 'Request body', required: false }], requiredPermissions: ['api.request'], maxRatePerSecond: 60, timeoutMs: 30000, costPerExecution: 0.005, requiresApproval: false, executable: true },
      { id: 'figma.export', name: 'Export from Figma', category: 'figma', description: 'Export assets from Figma', version: '1.0.0', parameters: [{ name: 'file_id', type: 'string', description: 'Figma file ID', required: true }, { name: 'node_id', type: 'string', description: 'Node ID', required: false }], requiredPermissions: ['figma.export'], maxRatePerSecond: 10, timeoutMs: 30000, costPerExecution: 0.05, requiresApproval: false, executable: true },
      { id: 'email.send', name: 'Send Email', category: 'email', description: 'Send an email', version: '1.0.0', parameters: [{ name: 'to', type: 'string', description: 'Recipient email', required: true }, { name: 'subject', type: 'string', description: 'Email subject', required: true }, { name: 'body', type: 'string', description: 'Email body', required: true }], requiredPermissions: ['email.send'], maxRatePerSecond: 20, timeoutMs: 10000, costPerExecution: 0.01, requiresApproval: true, executable: true },
      { id: 'calendar.create', name: 'Create Calendar Event', category: 'calendar', description: 'Create a calendar event', version: '1.0.0', parameters: [{ name: 'title', type: 'string', description: 'Event title', required: true }, { name: 'start', type: 'string', description: 'Start time', required: true }, { name: 'end', type: 'string', description: 'End time', required: true }], requiredPermissions: ['calendar.create'], maxRatePerSecond: 10, timeoutMs: 5000, costPerExecution: 0.01, requiresApproval: true, executable: true },
      { id: 'slack.send', name: 'Send Slack Message', category: 'slack', description: 'Send a message to Slack', version: '1.0.0', parameters: [{ name: 'channel', type: 'string', description: 'Channel name', required: true }, { name: 'message', type: 'string', description: 'Message text', required: true }], requiredPermissions: ['slack.send'], maxRatePerSecond: 30, timeoutMs: 5000, costPerExecution: 0.005, requiresApproval: false, executable: true },
      { id: 'notion.page', name: 'Create Notion Page', category: 'notion', description: 'Create a new Notion page', version: '1.0.0', parameters: [{ name: 'parent_id', type: 'string', description: 'Parent page ID', required: true }, { name: 'title', type: 'string', description: 'Page title', required: true }, { name: 'content', type: 'string', description: 'Page content', required: false }], requiredPermissions: ['notion.page'], maxRatePerSecond: 10, timeoutMs: 10000, costPerExecution: 0.01, requiresApproval: false, executable: true },
      { id: 'vercel.deploy', name: 'Deploy to Vercel', category: 'vercel', description: 'Deploy to Vercel', version: '1.0.0', parameters: [{ name: 'project', type: 'string', description: 'Project name', required: true }, { name: 'branch', type: 'string', description: 'Branch to deploy', required: false }], requiredPermissions: ['vercel.deploy'], maxRatePerSecond: 10, timeoutMs: 120000, costPerExecution: 0.02, requiresApproval: true, executable: true },
      { id: 'mcp.execute', name: 'Execute MCP Tool', category: 'mcp', description: 'Execute an MCP tool', version: '1.0.0', parameters: [{ name: 'server', type: 'string', description: 'MCP server name', required: true }, { name: 'tool', type: 'string', description: 'Tool name', required: true }, { name: 'arguments', type: 'object', description: 'Tool arguments', required: false }], requiredPermissions: ['mcp.execute'], maxRatePerSecond: 60, timeoutMs: 30000, costPerExecution: 0.01, requiresApproval: false, executable: true },
    ];

    for (const tool of defaults) {
      this.register(tool);
    }
  }

  register(tool: ToolPermissionConfig): void {
    this.tools.set(tool.id, tool);
    this.logger.debug('ToolPermissionManager: Tool registered', { toolId: tool.id, category: tool.category });
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  get(toolId: string): ToolPermissionConfig | undefined {
    return this.tools.get(toolId);
  }

  list(): ToolPermissionConfig[] {
    return Array.from(this.tools.values());
  }

  findByCategory(category: ToolCategory): ToolPermissionConfig[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  setAgentPermissions(agentId: string, permissions: ToolPermission[]): void {
    const map = new Map<string, ToolPermission>();
    for (const perm of permissions) {
      map.set(perm.toolId, perm);
    }
    this.agentPermissions.set(agentId, map);
    this.logger.debug('ToolPermissionManager: Permissions set for agent', { agentId, toolCount: permissions.length });
  }

  canUseTool(agentId: string, toolId: string): { allowed: boolean; reason?: string } {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { allowed: false, reason: `Tool ${toolId} not found` };
    }

    const permissions = this.agentPermissions.get(agentId);
    if (!permissions) {
      return { allowed: false, reason: `No permissions configured for agent ${agentId}` };
    }

    const perm = permissions.get(toolId);
    if (!perm) {
      return { allowed: false, reason: `Tool ${toolId} not permitted for agent ${agentId}` };
    }

    if (!perm.allowed) {
      return { allowed: false, reason: `Tool ${toolId} is disabled for agent ${agentId}` };
    }

    if (perm.rateLimit) {
      if (!this.checkRateLimit(agentId, toolId, perm.rateLimit)) {
        return { allowed: false, reason: 'Rate limit exceeded' };
      }
    }

    return { allowed: true };
  }

  async executeTool(agentId: string, toolId: string, parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const requestId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: ToolPermissionContext = {
      agentId,
      toolId,
      category: this.tools.get(toolId)?.category || 'custom',
      parameters,
      requestId,
      timestamp: new Date().toISOString(),
    };

    const startTime = Date.now();

    try {
      const check = this.canUseTool(agentId, toolId);
      if (!check.allowed) {
        return { success: false, error: check.reason, durationMs: 0, toolId, agentId };
      }

      const tool = this.tools.get(toolId);
      if (!tool) {
        return { success: false, error: `Tool ${toolId} not found`, durationMs: 0, toolId, agentId };
      }

      if (tool.requiresApproval) {
        const approved = await this.requestApproval(context);
        if (!approved) {
          return { success: false, error: 'Tool execution not approved', durationMs: 0, toolId, agentId };
        }
      }

      const result = await this.runTool(tool, context);
      this.recordExecution(context, result);
      return result;
    } catch (error) {
      const result: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        toolId,
        agentId,
      };
      this.recordExecution(context, result);
      return result;
    }
  }

  private checkRateLimit(agentId: string, toolId: string, limit: { requests: number; windowMs: number }): boolean {
    const key = `${agentId}:${toolId}`;
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    let requests = this.rateLimiter.get(key) || [];
    requests = requests.filter((t) => t > windowStart);
    this.rateLimiter.set(key, requests);

    return requests.length < limit.requests;
  }

  private async requestApproval(context: ToolPermissionContext): Promise<boolean> {
    const id = `approval_${context.requestId}`;
    this.approvalQueue.set(id, context);
    this.logger.info('ToolPermissionManager: Approval requested', { requestId: context.requestId, toolId: context.toolId, agentId: context.agentId });

    return new Promise((resolve) => {
      setTimeout(() => {
        this.approvalQueue.delete(id);
        resolve(false);
      }, 60000);

      const handler = (event: any) => {
        if (event.toolId === context.toolId && event.agentId === context.agentId) {
          this.eventBus.unsubscribe(subId);
          this.approvalQueue.delete(id);
          resolve(event.approved);
        }
      };

      const subId = this.eventBus.subscribe('tool:approval', handler);
    });
  }

  private async runTool(tool: ToolPermissionConfig, context: ToolPermissionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    if (!tool.executable || !tool.executor) {
      return {
        success: false,
        error: `Tool ${tool.id} is not executable in this environment`,
        durationMs: Date.now() - startTime,
        toolId: tool.id,
        agentId: context.agentId,
      };
    }

    const result = await tool.executor(context);
    result.durationMs = Date.now() - startTime;
    return result;
  }

  private recordExecution(context: ToolPermissionContext, result: ToolExecutionResult): void {
    this.executionHistory.push({ context, result, timestamp: new Date() });
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize / 2);
    }
  }

  getUsageStats(): Array<{ toolId: string; agentId: string; successful: number; failed: number; avgDurationMs: number }> {
    const stats: Map<string, { toolId: string; agentId: string; successful: number; failed: number; totalDuration: number; count: number }> = new Map();

    for (const exec of this.executionHistory) {
      const key = `${exec.context.toolId}:${exec.context.agentId}`;
      if (!stats.has(key)) {
        stats.set(key, { toolId: exec.context.toolId, agentId: exec.context.agentId, successful: 0, failed: 0, totalDuration: 0, count: 0 });
      }
      const s = stats.get(key)!;
      if (exec.result.success) s.successful++; else s.failed++;
      s.totalDuration += exec.result.durationMs;
      s.count++;
    }

    return Array.from(stats.values()).map((s) => ({
      toolId: s.toolId,
      agentId: s.agentId,
      successful: s.successful,
      failed: s.failed,
      avgDurationMs: s.count > 0 ? Math.round(s.totalDuration / s.count) : 0,
    }));
  }

  getStats(): { totalTools: number; totalExecutions: number; pendingApprovals: number; agentCount: number } {
    return {
      totalTools: this.tools.size,
      totalExecutions: this.executionHistory.length,
      pendingApprovals: this.approvalQueue.size,
      agentCount: this.agentPermissions.size,
    };
  }
}
