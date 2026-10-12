import * as http from 'http';
import * as https from 'https';
import { TraceSpan } from './types';

/** Convert an arbitrary string ID to a fixed-width hex string for OTLP. */
function toOTLPHex(id: string, byteLength: 8 | 16): string {
  const clean = id.replace(/-/g, '').replace(/[^0-9a-fA-F]/g, '0');
  const needed = byteLength * 2;
  if (clean.length >= needed) return clean.slice(0, needed).toLowerCase();
  return clean.toLowerCase().padEnd(needed, '0');
}

function isoToNanos(iso: string): string {
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return '0';
  return String(ms * 1_000_000);
}

function spanStatusCode(status: 'ok' | 'error' | 'timeout'): number {
  return status === 'ok' ? 1 : 2; // OTLP: 1=OK, 2=ERROR
}

function attributesToOTLP(attrs?: Record<string, unknown>): Array<{ key: string; value: Record<string, unknown> }> {
  if (!attrs) return [];
  return Object.entries(attrs).map(([key, val]) => {
    if (typeof val === 'string') return { key, value: { stringValue: val } };
    if (typeof val === 'number') return { key, value: { doubleValue: val } };
    if (typeof val === 'boolean') return { key, value: { boolValue: val } };
    return { key, value: { stringValue: String(val) } };
  });
}

/**
 * Exports completed TraceSpans to an OTLP-compatible receiver (Jaeger, Grafana Tempo, etc.)
 * via HTTP/JSON. Zero npm dependencies — uses only Node built-in http/https.
 *
 * Enabled by setting OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318).
 * Sends to: {endpoint}/v1/traces
 */
export class OTLPExporter {
  private exportUrl: URL;

  constructor(endpoint: string, private serviceName = 'agencyforge-runtime') {
    this.exportUrl = new URL('/v1/traces', endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint);
  }

  async exportSpans(spans: TraceSpan[]): Promise<void> {
    if (spans.length === 0) return;

    const otlpSpans = spans
      .filter((s) => s.endTime)
      .map((s) => ({
        traceId: toOTLPHex(s.traceId, 16),
        spanId: toOTLPHex(s.spanId, 8),
        ...(s.parentSpanId ? { parentSpanId: toOTLPHex(s.parentSpanId, 8) } : {}),
        name: s.operationName,
        kind: 1, // SPAN_KIND_INTERNAL
        startTimeUnixNano: isoToNanos(s.startTime),
        endTimeUnixNano: isoToNanos(s.endTime!),
        status: { code: spanStatusCode(s.status) },
        attributes: attributesToOTLP(s.attributes),
        events: (s.events ?? []).map((e) => ({
          timeUnixNano: isoToNanos(e.timestamp),
          name: e.name,
          attributes: attributesToOTLP(e.attributes),
        })),
      }));

    const body = JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.serviceName } },
              { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'agencyforge', version: '1.0.0' },
              spans: otlpSpans,
            },
          ],
        },
      ],
    });

    await this.post(body);
  }

  private post(body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const mod = this.exportUrl.protocol === 'https:' ? https : http;
      const req = mod.request(
        {
          hostname: this.exportUrl.hostname,
          port: this.exportUrl.port,
          path: this.exportUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          res.on('end', resolve);
        },
      );
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy(new Error('OTLP export timeout'));
      });
      req.write(body);
      req.end();
    });
  }
}
