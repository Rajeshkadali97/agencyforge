"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { buildStreamUrl } from "@/lib/stream-token";

export interface RuntimeEventMessage {
  type: "event" | "state_update" | "heartbeat" | "command" | "error";
  id: string;
  timestamp: string;
  payload: unknown;
}

export interface UseRuntimeStreamOptions {
  url?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
}

export interface RuntimeStreamState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempt: number;
  lastEvent: RuntimeEventMessage | null;
  lastHeartbeat: string | null;
  error: string | null;
}

export function useRuntimeStream(
  onEvent: (message: RuntimeEventMessage) => void,
  options: UseRuntimeStreamOptions = {}
) {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 10,
    reconnectIntervalMs = 3000,
  } = options;

  const overrideUrl = options.url;

  const [state, setState] = useState<RuntimeStreamState>({
    connected: false,
    reconnecting: false,
    reconnectAttempt: 0,
    lastEvent: null,
    lastHeartbeat: null,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectIdRef = useRef(0);
  const connectRef = useRef<() => void>(() => {});
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const disconnect = useCallback(() => {
    connectIdRef.current++;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((prev) => ({ ...prev, connected: false, reconnecting: false }));
  }, []);

  const openEventSource = useCallback((url: string) => {
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("connected", () => {
      reconnectAttemptRef.current = 0;
      setState((prev) => ({
        ...prev,
        connected: true,
        reconnecting: false,
        reconnectAttempt: 0,
        error: null,
      }));
    });

    eventSource.addEventListener("snapshot", (e) => {
      try {
        const payload = JSON.parse(e.data);
        onEventRef.current({
          type: "state_update",
          id: `snapshot_${Date.now()}`,
          timestamp: new Date().toISOString(),
          payload,
        });
      } catch {}
    });

    eventSource.addEventListener("event", (e) => {
      try {
        const message: RuntimeEventMessage = JSON.parse(e.data);
        onEventRef.current(message);
        setState((prev) => ({ ...prev, lastEvent: message }));
      } catch {}
    });

    eventSource.addEventListener("state_update", (e) => {
      try {
        const payload = JSON.parse(e.data);
        onEventRef.current({
          type: "state_update",
          id: `state_${Date.now()}`,
          timestamp: new Date().toISOString(),
          payload,
        });
      } catch {}
    });

    eventSource.addEventListener("heartbeat", () => {
      setState((prev) => ({
        ...prev,
        lastHeartbeat: new Date().toISOString(),
        connected: true,
      }));
    });

    eventSource.addEventListener("error", () => {
      setState((prev) => ({ ...prev, error: "Connection error" }));
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, connected: false, reconnecting: true }));

      if (autoReconnect && reconnectAttemptRef.current < maxReconnectAttempts) {
        const delay = reconnectIntervalMs * Math.pow(1.5, reconnectAttemptRef.current);
        reconnectAttemptRef.current++;
        setState((prev) => ({
          ...prev,
          reconnectAttempt: reconnectAttemptRef.current,
        }));
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, Math.min(delay, 30000));
      }
    };
  }, [autoReconnect, maxReconnectAttempts, reconnectIntervalMs]);

  const connect = useCallback(() => {
    disconnect();
    const myId = connectIdRef.current;

    if (overrideUrl) {
      openEventSource(overrideUrl);
      return;
    }

    // Fetch a fresh short-lived signed token before each connect so the long-lived
    // API key never appears in URLs (and thus never in access logs or browser history).
    void buildStreamUrl().then((url) => {
      if (connectIdRef.current === myId) openEventSource(url);
    });
  }, [overrideUrl, disconnect, openEventSource]);

  connectRef.current = connect;

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { ...state, connect, disconnect };
}
