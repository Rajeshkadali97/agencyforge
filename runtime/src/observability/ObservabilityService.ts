import { ILogger } from '../interfaces';
import { EnhancedEventBus } from '../events/EnhancedEventBus';
import { RuntimeEventTypes, RuntimeEvent, BaseEventPayload } from '../contracts';
import { MetricValue, TraceSpan, LogEntry, HealthCheckResult, ObservabilitySnapshot } from './types';
import { OTLPExporter } from './OTLPExporter';

export class ObservabilityService {
  private metrics: Map<string, MetricValue> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private activeTraces: Map<string, TraceSpan> = new Map();
  private completedTraces: TraceSpan[] = [];
  private logBuffer: LogEntry[] = [];
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private subscriptions: string[] = [];
  private startTime: number;
  private maxLogBufferSize = 1000;
  private maxCompletedTraces = 500;
  private maxHistogramSize = 1000;
  private otlpExporter?: OTLPExporter;
  private otlpExportInterval?: NodeJS.Timeout;

  constructor(
    private eventBus: EnhancedEventBus,
    private logger: ILogger
  ) {
    this.startTime = Date.now();
  }

  async initialize(): Promise<void> {
    this.subscriptions.push(
      this.eventBus.subscribe(
        [RuntimeEventTypes.SYSTEM_ERROR, RuntimeEventTypes.SYSTEM_WARNING],
        (event: RuntimeEvent<BaseEventPayload & { error?: string; warning?: string; component?: string; severity?: string }>) => {
          const level = event.type === RuntimeEventTypes.SYSTEM_ERROR ? 'error' : 'warn';
          this.addLog(level, event.payload.error ?? event.payload.warning ?? 'System event', {
            component: event.payload.component,
            traceId: event.traceId,
            spanId: event.spanId,
          });
        },
        { label: 'observability-system' }
      )
    );

    this.subscriptions.push(
      this.eventBus.subscribe(
        [
          RuntimeEventTypes.WORKFLOW_STARTED,
          RuntimeEventTypes.WORKFLOW_COMPLETED,
          RuntimeEventTypes.WORKFLOW_FAILED,
          RuntimeEventTypes.TASK_STARTED,
          RuntimeEventTypes.TASK_COMPLETED,
          RuntimeEventTypes.TASK_FAILED,
        ],
        (event: RuntimeEvent) => {
          this.incrementCounter(`events.${event.type.replace(/\./g, '_')}`);
        },
        { label: 'observability-events' }
      )
    );

    const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    if (otlpEndpoint) {
      this.otlpExporter = new OTLPExporter(otlpEndpoint, process.env['OTEL_SERVICE_NAME'] ?? 'agencyforge-runtime');
      this.otlpExportInterval = setInterval(() => {
        const pending = this.completedTraces.splice(0);
        if (pending.length > 0 && this.otlpExporter) {
          this.otlpExporter.exportSpans(pending).catch((err: unknown) => {
            this.logger.warn('ObservabilityService: OTLP export failed', { error: String(err) });
          });
        }
      }, 30_000);
      this.logger.info('ObservabilityService: OTLP export enabled', { endpoint: otlpEndpoint });
    }

    this.logger.info('ObservabilityService: Initialized');
  }

  async shutdown(): Promise<void> {
    if (this.otlpExportInterval) {
      clearInterval(this.otlpExportInterval);
      this.otlpExportInterval = undefined;
    }
    for (const subId of this.subscriptions) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptions = [];
    this.logger.info('ObservabilityService: Shutdown');
  }

  incrementCounter(name: string, delta = 1, tags?: Record<string, string>): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + delta);
    this.recordMetric(name, current + delta, 'count', tags);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(name, value);
    this.recordMetric(name, value, 'gauge', tags);
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    if (values.length > this.maxHistogramSize) {
      values.shift();
    }
    this.histograms.set(name, values);
    this.recordMetric(name, value, 'histogram', tags);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  getHistogramStats(name: string): { count: number; min: number; max: number; avg: number; p50: number; p95: number; p99: number } | undefined {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return undefined;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((s, v) => s + v, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)],
    };
  }

  startTrace(traceId: string, spanId: string, operationName: string, parentSpanId?: string, attributes?: Record<string, unknown>): TraceSpan {
    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: new Date().toISOString(),
      status: 'ok',
      attributes,
    };
    this.activeTraces.set(spanId, span);
    return span;
  }

  endTrace(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok', attributes?: Record<string, unknown>): TraceSpan | undefined {
    const span = this.activeTraces.get(spanId);
    if (!span) return undefined;

    span.endTime = new Date().toISOString();
    span.durationMs = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
    span.status = status;

    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes };
    }

    this.activeTraces.delete(spanId);
    this.completedTraces.push(span);
    if (this.completedTraces.length > this.maxCompletedTraces) {
      this.completedTraces = this.completedTraces.slice(-this.maxCompletedTraces);
    }

    this.recordHistogram(`trace.${span.operationName}.duration`, span.durationMs);
    return span;
  }

  addTraceEvent(spanId: string, eventName: string, attributes?: Record<string, unknown>): void {
    const span = this.activeTraces.get(spanId);
    if (span) {
      if (!span.events) span.events = [];
      span.events.push({ name: eventName, timestamp: new Date().toISOString(), attributes });
    }
  }

  addLog(level: LogEntry['level'], message: string, meta?: Record<string, unknown>): void {
    this.logBuffer.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      meta,
      traceId: meta?.traceId as string | undefined,
      spanId: meta?.spanId as string | undefined,
      component: meta?.component as string | undefined,
    });
    if (this.logBuffer.length > this.maxLogBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogBufferSize);
    }
  }

  getLogs(level?: string, limit?: number): LogEntry[] {
    let logs = [...this.logBuffer];
    if (level) {
      logs = logs.filter((l) => l.level === level);
    }
    return limit ? logs.slice(-limit) : logs;
  }

  registerHealthCheck(component: string, check: () => Promise<{ healthy: boolean; message?: string }>): void {
    const runCheck = async () => {
      const startTime = Date.now();
      try {
        const result = await check();
        this.healthChecks.set(component, {
          component,
          healthy: result.healthy,
          message: result.message,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      } catch (err) {
        this.healthChecks.set(component, {
          component,
          healthy: false,
          message: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
      }
    };

    runCheck();
    const interval = setInterval(runCheck, 30000);
    if (typeof interval.unref === 'function') {
      interval.unref();
    }
  }

  getHealthChecks(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  getSnapshot(): ObservabilitySnapshot {
    return {
      metrics: Array.from(this.metrics.values()).slice(-100),
      activeTraces: this.activeTraces.size,
      recentLogs: this.logBuffer.slice(-50),
      healthChecks: Array.from(this.healthChecks.values()),
      uptimeMs: Date.now() - this.startTime,
    };
  }

  private recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.metrics.set(name, {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
    });
  }
}
