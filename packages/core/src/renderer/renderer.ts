import * as RoughModule from 'roughjs'
import type { RoughSVG } from 'roughjs/bin/svg.js'
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom'
import { drawNode } from './shapes.js'
import { drawEdge } from './edges.js'
import { createLabel, createEdgeLabel } from './labels.js'
import { FONT_STYLE, FONT_FALLBACK_STYLE } from './fonts.js'
import { resolveStyle } from './styles.js'
import { deriveSeed, seededRandom } from '../layout/seed.js'
import type { LayoutResult } from '../ir/types.js'

// roughjs ships CJS with no `exports` field — access default via namespace import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rough = ((RoughModule as any).default ?? RoughModule) as {
  svg(el: SVGSVGElement): RoughSVG
}

// Type alias to avoid casting xmldom Document vs browser Document everywhere
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

export function renderToSvg(layout: LayoutResult): string {
  const impl = new DOMImplementation()
  // Cast to any to bridge xmldom types with browser DOM types used by rough.js
  const doc: AnyDoc = impl.createDocument('http://www.w3.org/2000/svg', 'svg', null)
  const svg = doc.documentElement as SVGSVGElement | null
  if (!svg) throw new Error('Failed to create SVG document root')

  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width', String(Math.ceil(layout.width)))
  svg.setAttribute('height', String(Math.ceil(layout.height)))
  svg.setAttribute('viewBox', `0 0 ${Math.ceil(layout.width)} ${Math.ceil(layout.height)}`)

  // Defs: font
  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
  const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = FONT_STYLE + FONT_FALLBACK_STYLE
  defs.appendChild(styleEl)
  svg.appendChild(defs)

  // Resolve style preset
  const style = resolveStyle(layout.meta.style)

  // rough.js SVG renderer
  const rc = rough.svg(svg)

  // Identify "spirit line" element — the one with highest seededRandom gets boosted roughness
  let spiritElement = ''
  let spiritScore = -1
  for (const node of layout.nodes) {
    const s = seededRandom(deriveSeed(layout.seed, node.id))
    if (s > spiritScore) { spiritScore = s; spiritElement = node.id }
  }

  // Groups layer (background — render first, nodes occlude)
  const groupsG = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  groupsG.setAttribute('class', 'scrawl-groups')
  for (const group of layout.groups) {
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    gEl.setAttribute('data-id', group.id)
    const groupSeed = deriveSeed(layout.seed, group.id)
    const bg = rc.rectangle(
      group.x - group.width / 2,
      group.y - group.height / 2,
      group.width,
      group.height,
      {
        roughness: style.roughness[0],
        fill: '#f7fafc',
        fillStyle: 'solid',
        stroke: '#cbd5e0',
        strokeWidth: 1.5,
        seed: groupSeed,
        disableMultiStroke: !style.multiStroke,
      },
    )
    gEl.appendChild(bg)
    if (group.label) {
      const lbl = createLabel(doc, group.label, group.x, group.y - group.height / 2 + 14, 13, groupSeed, style)
      lbl.setAttribute('fill', '#718096')
      gEl.appendChild(lbl)
    }
    groupsG.appendChild(gEl)
  }
  svg.appendChild(groupsG)

  // Edges layer
  const edgesG = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  edgesG.setAttribute('class', 'scrawl-edges')
  for (const edge of layout.edges) {
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    gEl.setAttribute('data-from', edge.from)
    gEl.setAttribute('data-to', edge.to)
    const edgeEls = drawEdge(rc, edge, layout.seed, style, doc)
    for (const el of edgeEls) gEl.appendChild(el)
    if (edge.label && edge.points.length >= 2) {
      const mid = Math.floor(edge.points.length / 2)
      const pt = edge.points[mid]!
      const edgeSeed = deriveSeed(layout.seed, edge.from + '->' + edge.to)
      const lbl = createEdgeLabel(doc, edge.label, pt[0], pt[1] - 10, edgeSeed, style)
      gEl.appendChild(lbl)
    }
    edgesG.appendChild(gEl)
  }
  svg.appendChild(edgesG)

  // Nodes layer (top — drawn last so labels are always visible)
  const nodesG = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  nodesG.setAttribute('class', 'scrawl-nodes')
  for (const node of layout.nodes) {
    const gEl = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    gEl.setAttribute('data-id', node.id)
    const shapeEls = drawNode(rc, node, layout.seed, style, spiritElement)
    for (const el of shapeEls) gEl.appendChild(el)
    const nodeSeed = deriveSeed(layout.seed, node.id)
    const lbl = createLabel(doc, node.label, node.x, node.y, 16, nodeSeed, style)
    gEl.appendChild(lbl)
    nodesG.appendChild(gEl)
  }
  svg.appendChild(nodesG)

  const serializer = new XMLSerializer()
  return serializer.serializeToString(doc)
}
