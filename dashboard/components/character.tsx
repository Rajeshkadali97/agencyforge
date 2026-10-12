"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CharacterRegistry,
  type CharacterId,
  type CharacterRuntimeState,
  type CharacterStatePatch,
} from "@/lib/characters";
import type { CharacterEmotion as DashboardEmotion, DepartmentId } from "@/components/characters/core/types";
import { Avatar3D, AVATAR_PALETTE, type AvatarMood, type AvatarRole } from "@/components/avatar3d";

const sizes = {
  sm: { container: 48 },
  md: { container: 64 },
  lg: { container: 80 },
  xl: { container: 120 },
  hero: { container: 176 },
};

const departmentToCharacterId: Record<DepartmentId | string, CharacterId> = {
  ceo: "ceo",
  research: "research-agent",
  marketing: "marketing-agent",
  sales: "sales-agent",
  automation: "automation-agent",
  website: "web-architect",
  creative: "creative-director",
  content: "content-strategist",
  motion: "motion-designer",
  seo: "seo-specialist",
  analytics: "analytics-expert",
  web: "web-architect",
  developer: "developer",
};

function toCharacterId(value: DepartmentId | CharacterId | string): CharacterId {
  return departmentToCharacterId[value] ?? (value as CharacterId) ?? "ceo";
}

function emotionToPatch(emotion?: DashboardEmotion | string): CharacterStatePatch {
  switch (emotion) {
    case "thinking":
    case "loading":
      return { runtimeState: "Thinking", emotion: "thinking", pose: "thinking", status: "processing" };
    case "working":
      return { runtimeState: "Busy", emotion: "focused", pose: "typing", status: "busy" };
    case "speaking":
    case "talking":
      return { runtimeState: "Talking", emotion: "talking", pose: "talking", status: "speaking" };
    case "listening":
      return { runtimeState: "Listening", emotion: "listening", pose: "listening", status: "available" };
    case "happy":
      return { runtimeState: "Happy", emotion: "happy", pose: "standing", status: "available" };
    case "excited":
    case "celebrating":
      return { runtimeState: "Celebrating", emotion: "celebrating", pose: "celebrating", status: "available" };
    case "concerned":
    case "warning":
      return { runtimeState: "Worried", emotion: "worried", pose: "thinking", status: "warning" };
    case "error":
      return { runtimeState: "Error", emotion: "stressed", pose: "typing", status: "error" };
    case "sleeping":
      return { runtimeState: "Sleeping", emotion: "sleepy", pose: "sitting", status: "idle" };
    case "offline":
      return { runtimeState: "Offline", emotion: "sleepy", pose: "idle", status: "offline" };
    case "idle":
    default:
      return { runtimeState: "Idle", emotion: "neutral", pose: "idle", status: "idle" };
  }
}

function moodFrom(emotion?: DashboardEmotion | string, state?: CharacterRuntimeState): AvatarMood {
  const key = String(state ? state : emotion ?? "idle").toLowerCase();
  switch (key) {
    case "thinking":
    case "loading":
      return "thinking";
    case "working":
    case "busy":
    case "focused":
      return "working";
    case "speaking":
    case "talking":
      return "speaking";
    case "listening":
      return "listening";
    case "happy":
      return "happy";
    case "excited":
    case "celebrating":
      return "celebrating";
    case "concerned":
    case "warning":
    case "worried":
      return "worried";
    case "error":
      return "error";
    case "sleeping":
      return "sleeping";
    case "offline":
      return "offline";
    default:
      return "idle";
  }
}

interface CharacterRendererProps {
  characterId?: CharacterId;
  department?: DepartmentId | string;
  emotion?: DashboardEmotion | string;
  state?: CharacterRuntimeState;
  size?: keyof typeof sizes;
  className?: string;
  /** Kept for API compatibility. Avatars are vector art, so this has no effect. */
  imageClassName?: string;
  label?: string;
}

function CharacterRenderer({
  characterId,
  department = "ceo",
  emotion = "idle",
  state,
  size = "md",
  className,
  label,
}: CharacterRendererProps) {
  const id = characterId ?? toCharacterId(department);
  const snapshot = React.useMemo(() => {
    const patch = emotionToPatch(emotion);
    return CharacterRegistry.update(id, state ? { ...patch, runtimeState: state } : patch);
  }, [emotion, id, state]);

  const role = (id in AVATAR_PALETTE ? id : "ceo") as AvatarRole;
  const palette = AVATAR_PALETTE[role];
  const mood = moodFrom(emotion, state);
  const config = sizes[size];

  return (
    <motion.div
      className={cn("relative overflow-hidden rounded-2xl border border-white/70", className)}
      style={{
        width: config.container,
        height: config.container,
        background: `radial-gradient(circle at 28% 18%, ${palette.light}99 0%, transparent 62%), linear-gradient(165deg, #ffffff 0%, ${palette.light}40 100%)`,
        boxShadow: `0 6px 18px ${palette.base}26, 0 0 0 1px ${palette.base}1f, inset 0 1px 1px rgba(255,255,255,0.9)`,
      }}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      aria-label={label ?? `${snapshot.name} (${mood})`}
      data-character-id={id}
      data-character-mood={mood}
    >
      <Avatar3D role={role} mood={mood} title={label ?? snapshot.name} />
    </motion.div>
  );
}

interface CharacterFaceProps {
  department: DepartmentId | string;
  emotion?: DashboardEmotion | string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showThinking?: boolean;
  showSparkles?: boolean;
}

function CharacterFace({ department, emotion = "idle", size = "md", className }: CharacterFaceProps) {
  return <CharacterRenderer department={department} emotion={emotion} size={size} className={className} />;
}

interface CharacterWithMessageProps {
  department: DepartmentId | string;
  emotion?: DashboardEmotion | string;
  name?: string;
  title?: string;
  message?: string;
  size?: "sm" | "md" | "lg" | "xl";
  compact?: boolean;
  className?: string;
}

function CharacterWithMessage({
  department,
  emotion = "idle",
  name,
  title,
  message,
  size = "md",
  compact = false,
  className,
}: CharacterWithMessageProps) {
  const displayName = name || department.charAt(0).toUpperCase() + department.slice(1);

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <CharacterRenderer department={department} emotion={emotion} size={size} />
      {!compact && (
        <div className="min-w-0 flex-1">
          {name && <h3 className="text-[15px] font-medium text-[hsl(var(--foreground))]">{displayName}</h3>}
          {title && <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{title}</p>}
          {message && <p className="mt-2 text-[13px] italic leading-relaxed text-[hsl(var(--foreground))]">&ldquo;{message}&rdquo;</p>}
        </div>
      )}
    </div>
  );
}

export { CharacterFace, CharacterRenderer, CharacterWithMessage };
export type { CharacterFaceProps, CharacterRendererProps, CharacterWithMessageProps };
