import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutEdge } from '../ir/types.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed, seededRandom } from '../layout/seed.js'

type SvgDoc = {
  createElementNS: (ns: string, tag: string) => { setAttribute: (k: string, v: string) => void }
}

// ---------------------------------------------------------------------------
// Catmull-Rom → cubic Bezier conversion for smooth edge curves
// ---------------------------------------------------------------------------

function catmullRomToBezier(points: Array<[number, number]>, tension: number): string {
  if (points.length < 2) return ''
  const d: string[] = [`M ${points[0][0]} ${points[0][1]}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const t = tension
    const cp1x = p1[0] + (p2[0] - p0[0]) * t / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) * t / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) * t / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) * t / 6

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`)
  }
  return d.join(' ')
}

// ---------------------------------------------------------------------------
// Edge drawing
// ---------------------------------------------------------------------------

export function drawEdge(
  rc: RoughSVG,
  edge: LayoutEdge,
  globalSeed: number,
  style: RenderStyle,
  svgDoc: SvgDoc,
): SVGElement[] {
  if (edge.points.length < 2) return []

  const edgeSeed = deriveSeed(globalSeed, edge.from + '->' + edge.to)
  const elements: SVGElement[] = []
  const strokeDasharray =
    edge.style === 'dashed' ? '8,4' : edge.style === 'dotted' ? '2,4' : undefined

  const [rMin, rMax] = style.roughness
  const [bMin, bMax] = style.bowing
  const [swMin, swMax] = style.strokeWidth

  const opts = {
    roughness: rMin + seededRandom(edgeSeed, 0) * (rMax - rMin),
    bowing: bMin + seededRandom(edgeSeed, 1) * (bMax - bMin),
    strokeWidth: swMin + seededRandom(edgeSeed, 2) * (swMax - swMin),
    stroke: '#2d3748',
    seed: edgeSeed,
    disableMultiStroke: !style.multiStroke,
  }

  // Choose rendering method: smooth Bezier curves or linear path
  let path: SVGElement
  if (style.edgeCurvature > 0 && edge.points.length >= 3) {
    const pathD = catmullRomToBezier(edge.points, style.edgeCurvature)
    path = rc.path(pathD, opts) as unknown as SVGElement
  } else {
    path = rc.linearPath(edge.points, opts) as unknown as SVGElement
  }
  if (strokeDasharray) path.setAttribute('stroke-dasharray', strokeDasharray)
  elements.push(path)

  // Double-line mode: draw edge again with offset seed, reduced opacity/width
  if (style.doubleLine) {
    const doubleOpts = {
      ...opts,
      seed: edgeSeed + 1,
      strokeWidth: opts.strokeWidth * 0.8,
    }
    let doublePath: SVGElement
    if (style.edgeCurvature > 0 && edge.points.length >= 3) {
      const pathD = catmullRomToBezier(edge.points, style.edgeCurvature)
      doublePath = rc.path(pathD, doubleOpts) as unknown as SVGElement
    } else {
      doublePath = rc.linearPath(edge.points, doubleOpts) as unknown as SVGElement
    }
    if (strokeDasharray) doublePath.setAttribute('stroke-dasharray', strokeDasharray)
    doublePath.setAttribute('opacity', String(style.doubleLineOpacity))
    elements.push(doublePath)
  }

  // Arrowhead at end
  if (edge.arrow === 'arrow' || edge.arrow === 'both') {
    const last = edge.points[edge.points.length - 1]!
    const prev = edge.points[edge.points.length - 2]!
    elements.push(drawArrowHead(rc, style, edgeSeed, prev, last, svgDoc))
  }
  if (edge.arrow === 'both') {
    const first = edge.points[0]!
    const second = edge.points[1]!
    elements.push(drawArrowHead(rc, style, edgeSeed + 99, second, first, svgDoc))
  }

  return elements
}

// ---------------------------------------------------------------------------
// Arrowheads — rough (two sketchy barb lines) or clean (polygon)
// ---------------------------------------------------------------------------

function drawArrowHead(
  rc: RoughSVG,
  style: RenderStyle,
  seed: number,
  from: [number, number],
  to: [number, number],
  doc: SvgDoc,
): SVGElement {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
  const baseSize = 10

  if (style.arrowStyle === 'clean') {
    const p1: [number, number] = [
      to[0] - baseSize * Math.cos(angle - 0.4),
      to[1] - baseSize * Math.sin(angle - 0.4),
    ]
    const p2: [number, number] = [
      to[0] - baseSize * Math.cos(angle + 0.4),
      to[1] - baseSize * Math.sin(angle + 0.4),
    ]
    const polygon = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon')
    polygon.setAttribute('points', `${to[0]},${to[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`)
    polygon.setAttribute('fill', '#2d3748')
    polygon.setAttribute('stroke', 'none')
    return polygon as unknown as SVGElement
  }

  // Rough arrowhead: two hand-drawn barb lines with seeded jitter
  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')

  const angleJitter1 = (seededRandom(seed, 10) - 0.5) * 2 * style.arrowAngleJitter
  const angleJitter2 = (seededRandom(seed, 11) - 0.5) * 2 * style.arrowAngleJitter
  const sizeJitter1 = 1 + (seededRandom(seed, 12) - 0.5) * 2 * style.arrowSizeJitter
  const sizeJitter2 = 1 + (seededRandom(seed, 13) - 0.5) * 2 * style.arrowSizeJitter

  const size1 = baseSize * sizeJitter1
  const size2 = baseSize * sizeJitter2

  const p1: [number, number] = [
    to[0] - size1 * Math.cos(angle - 0.4 + angleJitter1),
    to[1] - size1 * Math.sin(angle - 0.4 + angleJitter1),
  ]
  const p2: [number, number] = [
    to[0] - size2 * Math.cos(angle + 0.4 + angleJitter2),
    to[1] - size2 * Math.sin(angle + 0.4 + angleJitter2),
  ]

  const [rMin, rMax] = style.roughness
  const [swMin, swMax] = style.strokeWidth
  const barbRoughness = rMin + seededRandom(seed, 14) * (rMax - rMin)
  const barbStrokeWidth = swMin + seededRandom(seed, 15) * (swMax - swMin)
  const barbOpts = { roughness: barbRoughness, strokeWidth: barbStrokeWidth, stroke: '#2d3748', seed }
  g.appendChild(rc.line(to[0], to[1], p1[0], p1[1], barbOpts) as unknown as SVGElement)
  g.appendChild(rc.line(to[0], to[1], p2[0], p2[1], { ...barbOpts, seed: seed + 1 }) as unknown as SVGElement)

  return g as unknown as SVGElement
}
