// =============================================================================
// AgencyForge Character System - Core Types
// =============================================================================
// This file defines all TypeScript interfaces and types for the 
// Character System that represents AI agents as living, animated characters.
// =============================================================================

import { type Variants } from "framer-motion";
import React from "react";

// =============================================================================
// EMOTION SYSTEM
// =============================================================================

export type CharacterEmotion =
  | "idle"
  | "thinking"
  | "working"
  | "happy"
  | "excited"
  | "warning"
  | "error"
  | "celebrating"
  | "sleeping"
  | "talking"
  | "listening"
  | "speaking"
  | "concerned"
  | "offline"
  | "loading";

export type EmotionIntensity = "subtle" | "moderate" | "intense";

export interface EmotionConfig {
  name: CharacterEmotion;
  eyebrowAngle: number;     // degrees: -30 (furrowed) to +30 (surprised)
  eyeOpenness: number;        // 0 (closed) to 1 (wide open)
  mouthShape: "smile" | "frown" | "neutral" | "open" | "o-shape";
  mouthOpenness: number;      // 0 (closed) to 1 (wide)
  headTilt: number;          // degrees: -15 (left) to +15 (right)
  color: string;             // accent color for glow/aura
  animationSpeed: number;    // multiplier 0.5 (slow) to 2.0 (fast)
}

// =============================================================================
// POSE SYSTEM
// =============================================================================

export type CharacterPose =
  | "standing"
  | "sitting"
  | "walking"
  | "typing"
  | "pointing"
  | "reading"
  | "writing"
  | "coffee-break";

export interface PoseConfig {
  name: CharacterPose;
  bodyAngle: number;         // degrees: torso lean
  armPosition: "down" | "out" | "up" | "folded" | "typing" | "holding" | "waving";
  legPosition: "standing" | "crossed" | "walking" | "sitting";
  headHeight: number;        // vertical offset from baseline
  width: number;             // character width factor
}

// =============================================================================
// ANIMATION MODES
// =============================================================================

export type AnimationMode =
  | "blink"
  | "head-tilt"
  | "breathing"
  | "hand-wave"
  | "eye-direction"
  | "mouth-movement"
  | "floating"
  | "scale"
  | "bounce"
  | "celebrate";

export interface AnimationConfig {
  mode: AnimationMode;
  enabled: boolean;
  frequency?: number;        // times per second (for repeated animations)
  duration?: number;         // seconds for one-shot animations
  intensity?: number;      // 0.0 to 1.0
  delay?: number;            // seconds before starting
}

// =============================================================================
// ACCESSORY SYSTEM
// =============================================================================

export interface AccessoryItem {
  id: string;
  name: string;
  type: "head" | "face" | "neck" | "body" | "hand" | "ear" | "background";
  icon: React.ReactNode;     // Lucide icon or custom SVG
  color?: string;            // override color
  position: {               // relative to character center
    x: number;
    y: number;
  };
}

export type DepartmentId =
  | "ceo"
  | "research"
  | "marketing"
  | "sales"
  | "automation"
  | "website"
  | "creative"
  | "content"
  | "motion"
  | "seo"
  | "analytics";

export interface DepartmentConfig {
  id: DepartmentId;
  name: string;
  title: string;
  primaryColor: string;
  secondaryColor: string;
  accentIcon: string;
  defaultPose: CharacterPose;
  defaultEmotion: CharacterEmotion;
  accessories: AccessoryItem[];
}

// =============================================================================
// CHARACTER CONFIG
// =============================================================================

export interface CharacterSkin {
  baseColor: string;
  skinTone: "light" | "medium" | "dark" | "synthetic";
  eyeColor: string;
  hairColor: string;
  glowColor: string;
}

export interface CharacterProps {
  // Identity
  name: string;
  department: DepartmentId;
  title: string;
  
  // State
  emotion: CharacterEmotion;
  pose: CharacterPose;
  intensity?: EmotionIntensity;
  
  // Appearance
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  skin?: Partial<CharacterSkin>;
  imageUrl?: string;          // Replaceable character image
  
  // Animation
  animations?: AnimationConfig[];
  isSpeaking?: boolean;
  isListening?: boolean;
  isProcessing?: boolean;   // Shows "thinking" animation
  
  // Interaction
  onClick?: () => void;
  onEmotionChange?: (emotion: CharacterEmotion) => void;
  onPoseChange?: (pose: CharacterPose) => void;
  
  // Display
  showName?: boolean;
  showTitle?: boolean;
  showStatus?: boolean;
  className?: string;
}

// =============================================================================
// CHARACTER STATE
// =============================================================================

export interface CharacterState {
  emotion: CharacterEmotion;
  pose: CharacterPose;
  activeAnimations: Set<AnimationMode>;
  isSpeaking: boolean;
  isListening: boolean;
  currentIntensity: EmotionIntensity;
}

export type CharacterAction =
  | { type: "SET_EMOTION"; emotion: CharacterEmotion }
  | { type: "SET_POSE"; pose: CharacterPose }
  | { type: "ADD_ANIMATION"; mode: AnimationMode }
  | { type: "REMOVE_ANIMATION"; mode: AnimationMode }
  | { type: "SET_SPEAKING"; isSpeaking: boolean }
  | { type: "SET_LISTENING"; isListening: boolean }
  | { type: "SET_INTENSITY"; intensity: EmotionIntensity };

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export interface AnimationVariants {
  blink: Variants;
  breathing: Variants;
  headTilt: Variants;
  floating: Variants;
  bounce: Variants;
  celebrate: Variants;
  scale: Variants;
  handWave: Variants;
}

export type EmotionPreset = Record<CharacterEmotion, EmotionConfig>;
export type PosePreset = Record<CharacterPose, PoseConfig>;
export type AnimationPreset = Record<AnimationMode, Variants>;