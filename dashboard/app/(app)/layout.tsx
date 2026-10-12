import type { ReactNode } from "react";
import { AgentShell } from "@/components/shell";

/** Shared chrome (sidebar, mesh background) for every screen except the HQ home. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AgentShell className="select-text">{children}</AgentShell>;
}
