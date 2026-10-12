export interface MetricValue {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: 'ok' | 'error' | 'timeout';
  attributes?: Record<string, unknown>;
  events?: Array<{ name: string; timestamp: string; attributes?: Record<string, unknown> }>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  component?: string;
}

export interface HealthCheckResult {
  component: string;
  healthy: boolean;
  message?: string;
  timestamp: string;
  durationMs: number;
}

export interface ObservabilitySnapshot {
  metrics: MetricValue[];
  activeTraces: number;
  recentLogs: LogEntry[];
  healthChecks: HealthCheckResult[];
  uptimeMs: number;
}
