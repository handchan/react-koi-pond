import type { CSSProperties } from "react";

/** A color patch on the koi body */
export interface KoiPatch {
  /** Position along body 0-1 (0 = head, 1 = tail) */
  t: number;
  /** Lateral offset from spine, -1 (left) to 1 (right) */
  offset: number;
  /** Patch width along body, relative to body length */
  rx: number;
  /** Patch height across body, relative to local body width */
  ry: number;
  /** CSS color string */
  color: string;
}

/** Defines a koi color variety */
export interface KoiVariety {
  /** Base body fill color */
  base: string;
  /** Sheen highlight color (use rgba for transparency) */
  sheen: string;
  /** Color patches drawn on the body */
  patches: KoiPatch[];
}

export interface KoiPondProps {
  /** Number of koi fish (default: 9) */
  fishCount?: number;
  /** Fish body length range in px [min, max] (default: [50, 80]) */
  fishSize?: [number, number];
  /** Swimming speed multiplier (default: 1) */
  speed?: number;
  /** Custom koi varieties — if provided, replaces the built-in set */
  varieties?: KoiVariety[];
  /** Pond water gradient [top, middle, bottom] (default: ["#1a3a4a", "#0f2b3a", "#0a1f2e"]) */
  waterColor?: [string, string, string];
  /** Number of lily pads (default: random 4-6) */
  lilyPadCount?: number;
  /** Show lily pads (default: true) */
  showLilyPads?: boolean;
  /** Probability 0-1 that each lily pad has a bloom (default: 0.45) */
  bloomChance?: number;
  /** Show vignette overlay (default: true) */
  showVignette?: boolean;
  /** Click scare radius in px (default: 200) */
  scareRadius?: number;
  /** Ripple max radius in px (default: 140) */
  rippleSize?: number;
  /** Additional CSS class on the canvas element */
  className?: string;
  /** Additional inline styles on the canvas element */
  style?: CSSProperties;
}
