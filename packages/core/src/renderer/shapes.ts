import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutNode, ShapeType } from '../ir/types.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed, seededRandom } from '../layout/seed.js'

const COLORS: Record<string, string> = {
  red: '#e53e3e',
  blue: '#3182ce',
  green: '#38a169',
  yellow: '#d69e2e',
  purple: '#805ad5',
  orange: '#dd6b20',
  pink: '#d53f8c',
  gray: '#718096',
  teal: '#319795',
  cyan: '#0bc5ea',
}

function resolveColor(c: string | undefined): string | undefined {
  if (!c) return undefined
  return COLORS[c.toLowerCase()] ?? c
}

function roughOpts(elementSeed: number, style: RenderStyle, fill?: string) {
  const [rMin, rMax] = style.roughness
  const [bMin, bMax] = style.bowing
  const [swMin, swMax] = style.strokeWidth

  return {
    roughness: rMin + seededRandom(elementSeed, 0) * (rMax - rMin),
    bowing: bMin + seededRandom(elementSeed, 1) * (bMax - bMin),
    strokeWidth: swMin + seededRandom(elementSeed, 2) * (swMax - swMin),
    fillStyle: fill ? style.fillStyle : 'none',
    fill: fill ? fill + '33' : undefined, // 20% opacity fill
    hachureAngle: style.hachureAngle,
    hachureGap: style.hachureGap,
    seed: elementSeed,
    stroke: fill ?? '#2d3748',
    disableMultiStroke: !style.multiStroke,
    maxRandomnessOffset: style.cornerOvershoot ?? 2,
  }
}

export function drawNode(
  rc: RoughSVG,
  node: LayoutNode,
  globalSeed: number,
  style: RenderStyle,
  spiritElement?: string,
): SVGElement[] {
  const { x, y, width: w, height: h, shape } = node
  const fill = resolveColor(node.color)

  let elementSeed = deriveSeed(globalSeed, node.id)
  const opts = roughOpts(elementSeed, style, fill)

  // Spirit line: boost roughness for the chosen element
  if (spiritElement === `node:${node.id}` && style.spiritLineBoost > 0) {
    opts.roughness *= (1 + style.spiritLineBoost)
    opts.bowing *= (1 + style.spiritLineBoost)
  }

  const cx = x
  const cy = y // dagre centers

  const elements: SVGElement[] = []

  switch (shape as ShapeType) {
    case 'b':
      elements.push(rc.rectangle(cx - w / 2, cy - h / 2, w, h, opts) as unknown as SVGElement)
      break
    case 'r':
      // Rounded rect approximation via reduced roughness
      elements.push(
        rc.rectangle(cx - w / 2, cy - h / 2, w, h, { ...opts, roughness: opts.roughness * 0.6 }) as unknown as SVGElement,
      )
      break
    case 'c':
      elements.push(rc.ellipse(cx, cy, w, h, opts) as unknown as SVGElement)
      break
    case 'd': {
      const hw = w / 2
      const hh = h / 2
      elements.push(
        rc.polygon(
          [
            [cx, cy - hh],
            [cx + hw, cy],
            [cx, cy + hh],
            [cx - hw, cy],
          ],
          opts,
        ) as unknown as SVGElement,
      )
      break
    }
    case 'y': {
      // Cylinder: rectangle + top ellipse
      const ellH = h * 0.25
      elements.push(
        rc.rectangle(cx - w / 2, cy - h / 2 + ellH / 2, w, h - ellH, opts) as unknown as SVGElement,
      )
      elements.push(rc.ellipse(cx, cy - h / 2 + ellH / 2, w, ellH, opts) as unknown as SVGElement)
      break
    }
    case 'p': {
      const skew = 15
      elements.push(
        rc.polygon(
          [
            [cx - w / 2 + skew, cy - h / 2],
            [cx + w / 2, cy - h / 2],
            [cx + w / 2 - skew, cy + h / 2],
            [cx - w / 2, cy + h / 2],
          ],
          opts,
        ) as unknown as SVGElement,
      )
      break
    }
    case 'h': {
      const hw = w / 2
      const qw = w / 4
      const hh = h / 2
      elements.push(
        rc.polygon(
          [
            [cx - qw, cy - hh],
            [cx + qw, cy - hh],
            [cx + hw, cy],
            [cx + qw, cy + hh],
            [cx - qw, cy + hh],
            [cx - hw, cy],
          ],
          opts,
        ) as unknown as SVGElement,
      )
      break
    }
  }

  if (spiritElement === `node:${node.id}` && elements[0]) {
    elements[0].setAttribute('data-spirit-line', 'true')
  }

  return elements
}
