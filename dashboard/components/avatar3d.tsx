"use client";

import * as React from "react";

/**
 * Avatar3D — a studio-lit, 3D-style robot bust drawn as inline SVG.
 *
 * Every department gets its own colour, accessory and chest badge. The face
 * reacts to the agent's mood (thinking, working, speaking, error, ...). It is
 * pure vector: no image files, no licensing questions, a few KB per avatar.
 */

export type AvatarMood =
  | "idle"
  | "thinking"
  | "working"
  | "speaking"
  | "listening"
  | "happy"
  | "celebrating"
  | "worried"
  | "error"
  | "sleeping"
  | "offline";

export type AvatarRole =
  | "ceo"
  | "research-agent"
  | "sales-agent"
  | "marketing-agent"
  | "creative-director"
  | "content-strategist"
  | "motion-designer"
  | "web-architect"
  | "seo-specialist"
  | "analytics-expert"
  | "developer"
  | "automation-agent";

interface Palette {
  base: string;
  light: string;
  dark: string;
}

export const AVATAR_PALETTE: Record<AvatarRole, Palette> = {
  ceo: { base: "#8B5CF6", light: "#C4B5FD", dark: "#5B21B6" },
  "research-agent": { base: "#38BDF8", light: "#BAE6FD", dark: "#0369A1" },
  "sales-agent": { base: "#F59E0B", light: "#FDE68A", dark: "#B45309" },
  "marketing-agent": { base: "#34D399", light: "#A7F3D0", dark: "#047857" },
  "creative-director": { base: "#E879F9", light: "#F5D0FE", dark: "#A21CAF" },
  "content-strategist": { base: "#FB923C", light: "#FED7AA", dark: "#C2410C" },
  "motion-designer": { base: "#F43F5E", light: "#FECDD3", dark: "#BE123C" },
  "web-architect": { base: "#60A5FA", light: "#BFDBFE", dark: "#1D4ED8" },
  "seo-specialist": { base: "#2DD4BF", light: "#99F6E4", dark: "#0F766E" },
  "analytics-expert": { base: "#818CF8", light: "#C7D2FE", dark: "#4338CA" },
  developer: { base: "#22D3EE", light: "#A5F3FC", dark: "#0E7490" },
  "automation-agent": { base: "#A78BFA", light: "#DDD6FE", dark: "#6D28D9" },
};

interface Avatar3DProps {
  role: AvatarRole;
  mood?: AvatarMood;
  className?: string;
  title?: string;
}

function Accessory({ role, p, uid }: { role: AvatarRole; p: Palette; uid: string }) {
  switch (role) {
    case "ceo":
      return (
        <g>
          <path d="M68 42 L76 20 L90 36 L100 14 L110 36 L124 20 L132 42 Z" fill={`url(#${uid}-gold)`} stroke="#B45309" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="100" cy="28" r="3.6" fill={p.base} stroke="#fff" strokeWidth="1" />
          <circle cx="78" cy="26" r="2.4" fill="#fff" opacity=".8" />
          <circle cx="122" cy="26" r="2.4" fill="#fff" opacity=".8" />
        </g>
      );
    case "research-agent":
      return (
        <g>
          <line x1="100" y1="38" x2="100" y2="20" stroke="#475069" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="17" r="6" fill={`url(#${uid}-pod)`} />
          <circle cx="120" cy="88" r="17" fill="#fff" fillOpacity=".08" stroke="#FDE68A" strokeWidth="4" />
          <line x1="132" y1="100" x2="146" y2="116" stroke="#FDE68A" strokeWidth="4" strokeLinecap="round" />
          <path d="M110 80 Q116 74 124 76" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case "marketing-agent":
      return (
        <g>
          <path d="M42 88 C40 36 160 36 158 88" fill="none" stroke="#1F2937" strokeWidth="7" strokeLinecap="round" />
          <path d="M40 94 Q34 122 66 124" fill="none" stroke="#1F2937" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="68" cy="124" r="6" fill={`url(#${uid}-pod)`} stroke="#fff" strokeWidth="1.2" />
        </g>
      );
    case "sales-agent":
      return (
        <g>
          <path d="M92 146 H108 L113 172 L100 190 L87 172 Z" fill={`url(#${uid}-pod)`} stroke={p.dark} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M94 146 L100 156 L106 146" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
        </g>
      );
    case "automation-agent":
      return (
        <g className="af-spin" style={{ transformOrigin: "100px 24px" }}>
          <circle cx="100" cy="24" r="14" fill="none" stroke={p.base} strokeWidth="9" strokeDasharray="6.4 5.6" />
          <circle cx="100" cy="24" r="10" fill="#EDE9FE" stroke={p.dark} strokeWidth="2" />
          <circle cx="100" cy="24" r="4" fill={p.dark} />
        </g>
      );
    case "web-architect":
      return (
        <g>
          <path d="M50 58 C50 20 150 20 150 58 Z" fill={`url(#${uid}-gold)`} stroke="#B45309" strokeWidth="1.5" />
          <rect x="42" y="56" width="116" height="9" rx="4.5" fill="#F59E0B" stroke="#B45309" strokeWidth="1.5" />
          <path d="M92 26 H108 V50 H92 Z" fill="#fff" fillOpacity=".25" />
        </g>
      );
    case "creative-director":
      return (
        <g>
          <path d="M50 54 C54 16 142 8 154 46 C124 38 84 40 50 54 Z" fill={`url(#${uid}-pod)`} stroke={p.dark} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="132" cy="14" r="5" fill={p.dark} />
          <path d="M70 40 Q96 28 120 34" stroke="#fff" strokeOpacity=".5" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case "content-strategist":
      return (
        <g>
          <circle cx="80" cy="88" r="15" fill="none" stroke="#1F2937" strokeWidth="3.5" />
          <circle cx="120" cy="88" r="15" fill="none" stroke="#1F2937" strokeWidth="3.5" />
          <path d="M95 88 H105" stroke="#1F2937" strokeWidth="3.5" />
          <g transform="rotate(28 152 60)">
            <rect x="148" y="30" width="7" height="34" rx="2" fill="#FBBF24" stroke="#B45309" strokeWidth="1" />
            <path d="M148 64 L151.5 72 L155 64 Z" fill="#F4D3A1" stroke="#B45309" strokeWidth=".8" />
          </g>
        </g>
      );
    case "motion-designer":
      return (
        <g>
          <path d="M42 66 C62 50 138 50 158 66" fill="none" stroke={`url(#${uid}-pod)`} strokeWidth="9" strokeLinecap="round" />
          <circle cx="100" cy="52" r="10" fill="#fff" stroke={p.dark} strokeWidth="1.5" />
          <path d="M97 47 L105 52 L97 57 Z" fill={p.base} />
        </g>
      );
    case "seo-specialist":
      return (
        <g>
          <line x1="132" y1="42" x2="140" y2="26" stroke="#475069" strokeWidth="3" strokeLinecap="round" />
          <circle cx="142" cy="22" r="9" fill="#fff" fillOpacity=".15" stroke={p.base} strokeWidth="3.5" />
          <line x1="148" y1="29" x2="156" y2="38" stroke={p.base} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M138 24 L141 20 L146 24" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      );
    case "analytics-expert":
      return (
        <g>
          <rect x="82" y="30" width="9" height="12" rx="2.5" fill={p.base} />
          <rect x="95.5" y="20" width="9" height="22" rx="2.5" fill={`url(#${uid}-pod)`} />
          <rect x="109" y="26" width="9" height="16" rx="2.5" fill={p.light} />
        </g>
      );
    case "developer":
      return (
        <g>
          <path d="M42 84 C42 32 158 32 158 84" fill="none" stroke="#1F2937" strokeWidth="7" strokeLinecap="round" />
          <rect x="22" y="72" width="22" height="38" rx="11" fill="#1F2937" />
          <rect x="156" y="72" width="22" height="38" rx="11" fill="#1F2937" />
          <rect x="26" y="78" width="9" height="26" rx="4.5" fill={p.base} opacity=".9" />
          <rect x="165" y="78" width="9" height="26" rx="4.5" fill={p.base} opacity=".9" />
        </g>
      );
    default:
      return null;
  }
}

function ChestGlyph({ role }: { role: AvatarRole }) {
  const s = { stroke: "#fff", strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (role) {
    case "ceo":
      return <polygon points="0,-8 2.4,-2.6 8,-2.2 3.7,1.6 5,7.5 0,4.4 -5,7.5 -3.7,1.6 -8,-2.2 -2.4,-2.6" fill="#fff" />;
    case "research-agent":
      return (<g><circle cx="-1.5" cy="-1.5" r="5.5" {...s} /><line x1="2.5" y1="2.5" x2="7" y2="7" {...s} /></g>);
    case "sales-agent":
      return <text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui, sans-serif">$</text>;
    case "marketing-agent":
      return <path d="M-7 -2.5 H-2 L5.5 -7 V7 L-2 2.5 H-7 Z" fill="#fff" />;
    case "creative-director":
      return (<g><circle r="7.5" {...s} /><circle cx="-2.5" cy="-2" r="1.3" fill="#fff" /><circle cx="2.5" cy="-2.5" r="1.3" fill="#fff" /><circle cx="3" cy="2.5" r="1.3" fill="#fff" /></g>);
    case "content-strategist":
      return (<g><line x1="-7" y1="-5" x2="7" y2="-5" {...s} /><line x1="-7" y1="0" x2="7" y2="0" {...s} /><line x1="-7" y1="5" x2="2" y2="5" {...s} /></g>);
    case "motion-designer":
      return <path d="M-4 -7 L7.5 0 L-4 7 Z" fill="#fff" />;
    case "web-architect":
      return (<g><polyline points="-3,-5.5 -8,0 -3,5.5" {...s} /><polyline points="3,-5.5 8,0 3,5.5" {...s} /></g>);
    case "seo-specialist":
      return (<g><polyline points="-7.5,5 -2.5,0 1,3 7.5,-5" {...s} /><polyline points="2,-5.5 7.5,-5 7,0.5" {...s} /></g>);
    case "analytics-expert":
      return (<g><rect x="-7" y="0" width="4" height="7" rx="1" fill="#fff" /><rect x="-2" y="-6" width="4" height="13" rx="1" fill="#fff" /><rect x="3" y="-2.5" width="4" height="9.5" rx="1" fill="#fff" /></g>);
    case "developer":
      return <text y="5" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" fontFamily="ui-monospace, monospace">{"{}"}</text>;
    case "automation-agent":
      return <circle r="6.5" fill="none" stroke="#fff" strokeWidth="3.6" strokeDasharray="3.4 2.6" />;
    default:
      return null;
  }
}

function Eyes({ mood, p }: { mood: AvatarMood; p: Palette }) {
  const glow = mood === "error" ? "#FB7185" : mood === "offline" ? "#64748B" : p.light;
  const core = mood === "error" ? "#F43F5E" : mood === "offline" ? "#475569" : p.base;
  const stroke = { stroke: glow, strokeWidth: 5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const round = (shift: { x: number; y: number } = { x: 0, y: 0 }, ry = 9.5) => (
    <g className="af-blink" style={{ transformOrigin: "100px 90px" }} transform={`translate(${shift.x} ${shift.y})`}>
      {[80, 120].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="90" rx="8" ry={ry} fill={core} opacity=".35" />
          <ellipse cx={cx} cy="90" rx="6.2" ry={ry - 1.6} fill={glow} />
          <circle cx={cx - 2} cy={90 - ry / 2.4} r="2.2" fill="#fff" opacity=".9" />
        </g>
      ))}
    </g>
  );

  switch (mood) {
    case "happy":
    case "celebrating":
      return (
        <g>
          <path d="M71 94 Q80 80 89 94" {...stroke} />
          <path d="M111 94 Q120 80 129 94" {...stroke} />
        </g>
      );
    case "error":
      return (
        <g>
          <path d="M73 82 L87 98 M87 82 L73 98" {...stroke} />
          <path d="M113 82 L127 98 M127 82 L113 98" {...stroke} />
        </g>
      );
    case "sleeping":
      return (
        <g>
          <path d="M72 92 H88" {...stroke} />
          <path d="M112 92 H128" {...stroke} />
        </g>
      );
    case "offline":
      return (
        <g opacity=".7">
          <path d="M73 90 H87" {...stroke} />
          <path d="M113 90 H127" {...stroke} />
        </g>
      );
    case "working":
      return round({ x: 0, y: 2 }, 6);
    case "thinking":
      return round({ x: 4, y: -4 });
    case "worried":
      return (
        <g>
          {round({ x: 0, y: 3 }, 8.5)}
          <path d="M70 70 L89 77" {...stroke} strokeWidth="3.6" />
          <path d="M130 70 L111 77" {...stroke} strokeWidth="3.6" />
        </g>
      );
    default:
      return round();
  }
}

function Mouth({ mood, p }: { mood: AvatarMood; p: Palette }) {
  const c = mood === "error" ? "#FB7185" : p.light;
  if (mood === "speaking") {
    return <ellipse className="af-talk" cx="100" cy="109" rx="8" ry="5.5" fill={c} style={{ transformOrigin: "100px 109px" }} />;
  }
  if (mood === "worried" || mood === "error") {
    return <path d="M89 112 Q100 104 111 112" stroke={c} strokeWidth="3.6" fill="none" strokeLinecap="round" />;
  }
  if (mood === "sleeping" || mood === "offline") {
    return <path d="M94 109 H106" stroke={c} strokeWidth="3.4" strokeLinecap="round" opacity=".7" />;
  }
  if (mood === "happy" || mood === "celebrating") {
    return <path d="M86 104 Q100 120 114 104 Z" fill={c} opacity=".95" />;
  }
  if (mood === "working") {
    return <path d="M92 109 H108" stroke={c} strokeWidth="3.6" strokeLinecap="round" />;
  }
  return <path d="M89 105 Q100 114 111 105" stroke={c} strokeWidth="3.6" fill="none" strokeLinecap="round" />;
}

function MoodFx({ mood, p }: { mood: AvatarMood; p: Palette }) {
  switch (mood) {
    case "thinking":
      return (
        <g>
          <circle className="af-dot af-d1" cx="150" cy="38" r="4" fill={p.light} />
          <circle className="af-dot af-d2" cx="162" cy="28" r="5.2" fill={p.light} />
          <circle className="af-dot af-d3" cx="176" cy="18" r="6.4" fill={p.light} />
        </g>
      );
    case "celebrating":
      return (
        <g>
          <polygon className="af-dot af-d1" points="30,30 32.5,36 39,36.6 34,40.8 35.6,47 30,43.6 24.4,47 26,40.8 21,36.6 27.5,36" fill="#FDE047" />
          <polygon className="af-dot af-d2" points="172,40 174,44.8 179,45.2 175,48.6 176.2,53.4 172,50.8 167.8,53.4 169,48.6 165,45.2 170,44.8" fill="#F472B6" />
          <circle className="af-dot af-d3" cx="164" cy="22" r="3.2" fill="#38BDF8" />
          <circle className="af-dot af-d1" cx="36" cy="64" r="2.8" fill="#34D399" />
        </g>
      );
    case "sleeping":
      return (
        <g fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fill={p.light}>
          <text className="af-dot af-d1" x="150" y="46" fontSize="16">z</text>
          <text className="af-dot af-d2" x="162" y="32" fontSize="20">z</text>
          <text className="af-dot af-d3" x="176" y="16" fontSize="24">Z</text>
        </g>
      );
    case "error":
      return (
        <g>
          <circle cx="164" cy="34" r="13" fill="#F43F5E" stroke="#fff" strokeWidth="2" />
          <rect x="162" y="26" width="4" height="10" rx="2" fill="#fff" />
          <circle cx="164" cy="41" r="2.2" fill="#fff" />
        </g>
      );
    case "working":
      return (
        <g>
          <rect className="af-dot af-d1" x="146" y="30" width="22" height="5" rx="2.5" fill={p.light} />
          <rect className="af-dot af-d2" x="146" y="40" width="30" height="5" rx="2.5" fill={p.light} opacity=".75" />
          <rect className="af-dot af-d3" x="146" y="50" width="16" height="5" rx="2.5" fill={p.light} opacity=".55" />
        </g>
      );
    default:
      return null;
  }
}

export function Avatar3D({ role, mood = "idle", className, title }: Avatar3DProps) {
  const reactId = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const uid = `av${reactId}`;
  const p = AVATAR_PALETTE[role] ?? AVATAR_PALETTE.ceo;
  const offline = mood === "offline";

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={title ?? `${role} avatar, ${mood}`}
      style={{ width: "100%", height: "100%", filter: offline ? "grayscale(1)" : undefined, overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="48%" r="52%">
          <stop offset="0" stopColor={p.light} stopOpacity=".55" />
          <stop offset="1" stopColor={p.light} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset=".45" stopColor={p.base} />
          <stop offset="1" stopColor={p.dark} />
        </linearGradient>
        <linearGradient id={`${uid}-head`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".55" stopColor="#E7EBF6" />
          <stop offset="1" stopColor="#AEB8D3" />
        </linearGradient>
        <linearGradient id={`${uid}-screen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#252C4B" />
          <stop offset="1" stopColor="#0B1020" />
        </linearGradient>
        <linearGradient id={`${uid}-pod`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.light} />
          <stop offset="1" stopColor={p.base} />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FEF3C7" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-screenclip`}>
          <rect x="52" y="60" width="96" height="62" rx="26" />
        </clipPath>
      </defs>

      <circle cx="100" cy="104" r="86" fill={`url(#${uid}-halo)`} />

      <g className="af-float">
        {/* torso */}
        <path d="M34 204 C34 162 62 142 100 142 C138 142 166 162 166 204 Z" fill={`url(#${uid}-body)`} />
        <path d="M44 176 C50 158 70 148 100 148" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" strokeLinecap="round" />
        <path d="M166 204 C166 170 150 150 128 145" fill="none" stroke={p.dark} strokeOpacity=".35" strokeWidth="6" strokeLinecap="round" />

        {/* accessory behind head (sales tie sits on torso) */}
        {role === "sales-agent" && <Accessory role={role} p={p} uid={uid} />}

        {/* chest badge */}
        <g transform="translate(100 176)">
          <circle r="17" fill={p.dark} opacity=".35" transform="translate(0 2)" />
          <circle r="16" fill={`url(#${uid}-pod)`} stroke="#fff" strokeOpacity=".7" strokeWidth="1.6" />
          <ChestGlyph role={role} />
        </g>

        {/* neck */}
        <rect x="86" y="128" width="28" height="22" rx="8" fill="#1B2136" />
        <rect x="86" y="128" width="28" height="7" rx="3.5" fill="#000" opacity=".25" />

        {/* ear pods */}
        <circle cx="34" cy="88" r="13" fill={`url(#${uid}-pod)`} stroke={p.dark} strokeOpacity=".5" strokeWidth="1.5" className={mood === "listening" ? "af-pulse" : undefined} />
        <circle cx="166" cy="88" r="13" fill={`url(#${uid}-pod)`} stroke={p.dark} strokeOpacity=".5" strokeWidth="1.5" className={mood === "listening" ? "af-pulse" : undefined} />
        <circle cx="31" cy="85" r="4" fill="#fff" opacity=".55" />
        <circle cx="163" cy="85" r="4" fill="#fff" opacity=".55" />

        {/* head */}
        <rect x="38" y="36" width="124" height="104" rx="40" fill={p.dark} opacity=".28" transform="translate(0 5)" />
        <rect x="38" y="36" width="124" height="104" rx="40" fill={`url(#${uid}-head)`} />
        <rect x="38.8" y="36.8" width="122.4" height="102.4" rx="39.2" fill="none" stroke={p.light} strokeOpacity=".75" strokeWidth="1.6" />
        <path d="M58 50 C76 38 112 36 130 42" fill="none" stroke="#fff" strokeOpacity=".95" strokeWidth="5" strokeLinecap="round" />

        {/* face screen */}
        <rect x="52" y="60" width="96" height="62" rx="26" fill={`url(#${uid}-screen)`} />
        <g clipPath={`url(#${uid}-screenclip)`}>
          <path d="M40 60 L120 60 L84 122 L40 122 Z" fill={`url(#${uid}-gloss)`} />
          <ellipse cx="100" cy="132" rx="64" ry="18" fill={p.base} opacity=".16" />
        </g>
        <Eyes mood={mood} p={p} />
        <Mouth mood={mood} p={p} />

        {/* role accessory */}
        {role !== "sales-agent" && <Accessory role={role} p={p} uid={uid} />}
      </g>

      <MoodFx mood={mood} p={p} />
    </svg>
  );
}

export default Avatar3D;
