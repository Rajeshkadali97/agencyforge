"use client";

import { Toaster } from "@/hooks/use-toast";
import { DashboardProvider } from "@/lib/store-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "./theme-provider";
import { StreamConnector } from "@/components/stream-connector";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DashboardProvider>
          <StreamConnector />
          {children}
          <Toaster />
        </DashboardProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}