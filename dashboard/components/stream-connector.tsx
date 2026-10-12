"use client";

import * as React from "react";
import { useRuntimeStream, type RuntimeEventMessage } from "@/hooks/use-runtime-stream";
import { useDashboardStore } from "@/lib/store-context";

export function StreamConnector() {
  const store = useDashboardStore();

  const handleStreamMessage = React.useCallback((message: RuntimeEventMessage) => {
    if (message.type === "state_update") {
      const payload = message.payload as any;
      if (payload && typeof payload === "object") {
        if ("dashboard" in payload || "context" in payload) {
          store.processSnapshot(payload);
        } else if ("type" in payload) {
          store.processKernelMessage(payload);
        }
      }
    } else if (message.type === "event") {
      const payload = message.payload as any;
      if (payload && typeof payload === "object" && "type" in payload) {
        store.processKernelMessage(payload);
      }
    }
  }, [store]);

  const stream = useRuntimeStream(handleStreamMessage);

  React.useEffect(() => {
    store.setConnected(stream.connected);
  }, [stream.connected, store]);

  return null;
}
