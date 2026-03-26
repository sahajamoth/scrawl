import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutEdge } from '../ir/types.js'

export function drawEdge(rc: RoughSVG, edge: LayoutEdge, seed: number, svgDoc: { createElementNS: (ns: string, tag: string) => { setAttribute: (k: string, v: string) => void } }): SVGElement[] {
  if (edge.points.length < 2) return []

  const elements: SVGElement[] = []
  const strokeDasharray =
    edge.style === 'dashed' ? '8,4' : edge.style === 'dotted' ? '2,4' : undefined

  const opts = {
    roughness: 1.2,
    bowing: 0.8,
    strokeWidth: 1.5,
    stroke: '#2d3748',
    seed,
  }

  const path = rc.linearPath(edge.points, opts) as unknown as SVGElement
  if (strokeDasharray) path.setAttribute('stroke-dasharray', strokeDasharray)
  elements.push(path)

  // Arrowhead at end
  if (edge.arrow === 'arrow' || edge.arrow === 'both') {
    const last = edge.points[edge.points.length - 1]!
    const prev = edge.points[edge.points.length - 2]!
    elements.push(drawArrowHead(svgDoc, prev, last))
  }
  if (edge.arrow === 'both') {
    const first = edge.points[0]!
    const second = edge.points[1]!
    elements.push(drawArrowHead(svgDoc, second, first))
  }

  return elements
}

function drawArrowHead(
  doc: { createElementNS: (ns: string, tag: string) => { setAttribute: (k: string, v: string) => void } },
  from: [number, number],
  to: [number, number],
): SVGElement {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0])
  const size = 10
  const p1: [number, number] = [
    to[0] - size * Math.cos(angle - 0.4),
    to[1] - size * Math.sin(angle - 0.4),
  ]
  const p2: [number, number] = [
    to[0] - size * Math.cos(angle + 0.4),
    to[1] - size * Math.sin(angle + 0.4),
  ]

  const polygon = doc.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  polygon.setAttribute('points', `${to[0]},${to[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`)
  polygon.setAttribute('fill', '#2d3748')
  polygon.setAttribute('stroke', 'none')
  return polygon as unknown as SVGElement
}
