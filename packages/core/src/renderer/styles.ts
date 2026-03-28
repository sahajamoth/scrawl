import type { StylePreset } from '../ir/types.js'

export interface RenderStyle {
  // Stroke engine — [min, max] range for per-element variation
  roughness: [number, number]
  bowing: [number, number]
  strokeWidth: [number, number]

  // Shape rendering
  multiStroke: boolean
  cornerOvershoot: number      // px overshoot at corners (0 = none)
  fillStyle: string            // hachure, cross-hatch, dots, solid, none
  hachureGap: number
  hachureAngle: number

  // Edge rendering
  edgeCurvature: number        // 0 = angular, 1 = smooth bezier
  doubleLine: boolean
  doubleLineOpacity: number

  // Arrowheads
  arrowStyle: 'rough' | 'clean'
  arrowAngleJitter: number     // max angle variation per barb (radians)
  arrowSizeJitter: number      // max size variation per barb (fraction)

  // Text
  textWobble: boolean
  textWobbleAmount: number     // max displacement in px

  // Spirit line (Navajo principle — one element slightly more imperfect)
  spiritLineBoost: number      // extra roughness multiplier for the "spirit" element
}

export const PRESETS: Record<StylePreset, RenderStyle> = {
  sketch: {
    roughness: [1.2, 1.6],
    bowing: [0.8, 1.2],
    strokeWidth: [1.3, 1.7],
    multiStroke: true,
    cornerOvershoot: 2,
    fillStyle: 'hachure',
    hachureGap: 7,
    hachureAngle: -41,
    edgeCurvature: 0.7,
    doubleLine: false,
    doubleLineOpacity: 0.7,
    arrowStyle: 'rough',
    arrowAngleJitter: 0.1,
    arrowSizeJitter: 0.15,
    textWobble: true,
    textWobbleAmount: 0.8,
    spiritLineBoost: 0.3,
  },
  rough: {
    roughness: [2.0, 2.8],
    bowing: [1.5, 2.0],
    strokeWidth: [1.5, 2.2],
    multiStroke: true,
    cornerOvershoot: 4,
    fillStyle: 'hachure',
    hachureGap: 5,
    hachureAngle: -41,
    edgeCurvature: 0.9,
    doubleLine: true,
    doubleLineOpacity: 0.5,
    arrowStyle: 'rough',
    arrowAngleJitter: 0.2,
    arrowSizeJitter: 0.25,
    textWobble: true,
    textWobbleAmount: 1.5,
    spiritLineBoost: 0.5,
  },
  clean: {
    roughness: [0.3, 0.5],
    bowing: [0.2, 0.4],
    strokeWidth: [1.4, 1.6],
    multiStroke: false,
    cornerOvershoot: 0,
    fillStyle: 'solid',
    hachureGap: 7,
    hachureAngle: -41,
    edgeCurvature: 0.5,
    doubleLine: false,
    doubleLineOpacity: 0.7,
    arrowStyle: 'clean',
    arrowAngleJitter: 0,
    arrowSizeJitter: 0,
    textWobble: false,
    textWobbleAmount: 0,
    spiritLineBoost: 0,
  },
  architect: {
    roughness: [0.6, 0.9],
    bowing: [0.4, 0.7],
    strokeWidth: [1.0, 1.4],
    multiStroke: true,
    cornerOvershoot: 3,
    fillStyle: 'hachure',
    hachureGap: 8,
    hachureAngle: -41,
    edgeCurvature: 0.3,
    doubleLine: true,
    doubleLineOpacity: 0.6,
    arrowStyle: 'rough',
    arrowAngleJitter: 0.08,
    arrowSizeJitter: 0.1,
    textWobble: true,
    textWobbleAmount: 0.5,
    spiritLineBoost: 0.15,
  },
  blueprint: {
    roughness: [0.1, 0.2],
    bowing: [0.1, 0.1],
    strokeWidth: [1.2, 1.3],
    multiStroke: false,
    cornerOvershoot: 0,
    fillStyle: 'solid',
    hachureGap: 7,
    hachureAngle: -41,
    edgeCurvature: 0.4,
    doubleLine: false,
    doubleLineOpacity: 0.7,
    arrowStyle: 'clean',
    arrowAngleJitter: 0,
    arrowSizeJitter: 0,
    textWobble: false,
    textWobbleAmount: 0,
    spiritLineBoost: 0,
  },
}

/** Resolve a style preset name to its full RenderStyle config. */
export function resolveStyle(preset?: StylePreset): RenderStyle {
  return PRESETS[preset ?? 'sketch']
}
