import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutComponent, LayoutResult } from '../ir/types.js'
import { createLabel } from './labels.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed, seededRandom } from '../layout/seed.js'
import { polylineMidpoint } from './path-utils.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

function childComponents(layout: LayoutResult, parentId: string): LayoutComponent[] {
  return (layout.components ?? []).filter(component => component.parentId === parentId)
}

function componentOpts(seed: number, style: RenderStyle, stroke = '#2d3748', fill?: string, spirit = false) {
  const opts = {
    roughness: style.roughness[0] + seededRandom(seed, 0) * (style.roughness[1] - style.roughness[0]),
    bowing: style.bowing[0] + seededRandom(seed, 1) * (style.bowing[1] - style.bowing[0]),
    strokeWidth: style.strokeWidth[0] + seededRandom(seed, 2) * (style.strokeWidth[1] - style.strokeWidth[0]),
    stroke,
    fill: fill ? `${fill}22` : undefined,
    fillStyle: fill ? style.fillStyle : 'none',
    hachureAngle: style.hachureAngle,
    hachureGap: style.hachureGap,
    seed,
    disableMultiStroke: !style.multiStroke,
  }
  if (spirit && style.spiritLineBoost > 0) {
    opts.roughness *= (1 + style.spiritLineBoost)
    opts.bowing *= (1 + style.spiritLineBoost)
  }
  return opts
}

function stylePalette(style: RenderStyle) {
  if (style.fillStyle === 'solid' && !style.multiStroke) {
    return {
      stroke: '#334155',
      text: '#334155',
      line: '#94a3b8',
      panel: '#ffffff',
      soft: '#f8fafc',
      accent: '#2563eb',
    }
  }
  if (style.fillStyle === 'solid') {
    return {
      stroke: '#1e3a5f',
      text: '#1e3a5f',
      line: '#7da0c7',
      panel: '#eef6ff',
      soft: '#f5faff',
      accent: '#2563eb',
    }
  }
  return {
    stroke: '#4a5568',
    text: '#4a5568',
    line: '#718096',
    panel: '#ffffff',
    soft: '#f8fafc',
    accent: '#d97706',
  }
}

function simpleText(doc: AnyDoc, text: string, x: number, y: number, size: number, color = '#4a5568') {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('x', x.toFixed(1))
  el.setAttribute('y', y.toFixed(1))
  el.setAttribute('font-family', '"Permanent Marker", cursive')
  el.setAttribute('font-size', String(size))
  el.setAttribute('fill', color)
  el.textContent = text
  return el as SVGElement
}

function appendTitle(doc: AnyDoc, layer: SVGElement, component: LayoutComponent, size = 14) {
  if (!component.label) return
  layer.appendChild(simpleText(doc, component.label, component.x + 18, component.y + 24, size))
}

function renderPlaceholderLines(
  rc: RoughSVG,
  group: SVGElement,
  seed: number,
  x: number,
  y: number,
  width: number,
  lines: number,
) {
  for (let i = 0; i < lines; i++) {
    const w = width * (0.9 - (i % 3) * 0.08)
    const yy = y + i * 14
    group.appendChild(rc.line(x, yy, x + w, yy, { stroke: '#718096', roughness: 0.8, strokeWidth: 1.2, seed: seed + i }) as unknown as SVGElement)
  }
}

function renderFlowLayer(doc: AnyDoc, rc: RoughSVG, layout: LayoutResult, style: RenderStyle, spiritElement: string) {
  const flowsLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  flowsLayer.setAttribute('class', 'scrawl-wireframe-flows')
  const palette = stylePalette(style)
  for (const flow of layout.flows ?? []) {
    if (flow.points.length < 2) continue
    const flowSpirit = spiritElement === `flow:${flow.from}->${flow.to}`
    const path = rc.linearPath(flow.points, {
      stroke: palette.accent,
      roughness: flowSpirit ? 1.1 * (1 + style.spiritLineBoost) : 1.1,
      bowing: flowSpirit ? 0.9 * (1 + style.spiritLineBoost) : 0.9,
      strokeWidth: 2,
      seed: deriveSeed(layout.seed, `${flow.from}->${flow.to}`),
    }) as unknown as SVGElement
    if (flowSpirit) path.setAttribute('data-spirit-line', 'true')
    path.setAttribute('stroke-dasharray', '7,5')
    flowsLayer.appendChild(path)

    const to = flow.points[flow.points.length - 1]!
    const prev = flow.points[flow.points.length - 2]!
    const angle = Math.atan2(to[1] - prev[1], to[0] - prev[0])
    const size = 10
    const leftX = to[0] - Math.cos(angle - 0.45) * size
    const leftY = to[1] - Math.sin(angle - 0.45) * size
    const rightX = to[0] - Math.cos(angle + 0.45) * size
    const rightY = to[1] - Math.sin(angle + 0.45) * size
    flowsLayer.appendChild(rc.line(to[0], to[1], leftX, leftY, { stroke: palette.accent, roughness: 1, strokeWidth: 2, seed: deriveSeed(layout.seed, `${flow.from}->${flow.to}:l`) }) as unknown as SVGElement)
    flowsLayer.appendChild(rc.line(to[0], to[1], rightX, rightY, { stroke: palette.accent, roughness: 1, strokeWidth: 2, seed: deriveSeed(layout.seed, `${flow.from}->${flow.to}:r`) }) as unknown as SVGElement)
    if (flow.label) {
      const midpoint = polylineMidpoint(flow.points)
      const label = createLabel(doc, flow.label, midpoint[0], midpoint[1] - 12, 12, deriveSeed(layout.seed, `${flow.from}->${flow.to}:label`), style)
      label.setAttribute('fill', palette.accent)
      flowsLayer.appendChild(label)
    }
  }
  return flowsLayer
}

export function renderWireframe(
  doc: AnyDoc,
  svg: SVGSVGElement,
  rc: RoughSVG,
  layout: LayoutResult,
  style: RenderStyle,
) {
  const palette = stylePalette(style)
  const spiritCandidates = [
    ...(layout.components ?? []).map(component => `component:${component.id}`),
    ...(layout.flows ?? []).map(flow => `flow:${flow.from}->${flow.to}`),
  ]
  let spiritElement = ''
  let spiritScore = -1
  for (const candidate of spiritCandidates) {
    const score = seededRandom(deriveSeed(layout.seed, candidate))
    if (score > spiritScore) {
      spiritScore = score
      spiritElement = candidate
    }
  }

  const flowsLayer = renderFlowLayer(doc, rc, layout, style, spiritElement)
  svg.appendChild(flowsLayer)

  const layer = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  layer.setAttribute('class', 'scrawl-components')

  const components = layout.components ?? []
  for (const component of components) {
    const seed = deriveSeed(layout.seed, component.id)
    const componentSpirit = spiritElement === `component:${component.id}`
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('data-kind', component.kind)
    group.setAttribute('data-id', component.id)
    if (componentSpirit) group.setAttribute('data-spirit-line', 'true')

    const x = component.x
    const y = component.y
    const w = component.width
    const h = component.height
    const children = childComponents(layout, component.id)

    switch (component.kind) {
      case 'screen':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        if (component.label) {
          const title = createLabel(doc, component.label, x + w / 2, y + 18, 16, seed, style)
          title.setAttribute('fill', palette.text)
          group.appendChild(title)
        }
        break
      case 'header':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        break
      case 'sidebar':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.line, palette.soft, componentSpirit)) as unknown as SVGElement)
        appendTitle(doc, group, component)
        break
      case 'panel':
      case 'card':
      case 'column':
      case 'row':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, component.kind === 'card' ? palette.panel : palette.soft, componentSpirit)) as unknown as SVGElement)
        if (component.kind !== 'row') appendTitle(doc, group, component)
        break
      case 'button': {
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        const label = createLabel(doc, component.label, x + w / 2, y + h / 2 + 1, 15, seed, style)
        group.appendChild(label)
        break
      }
      case 'input':
      case 'select':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 14, y + 20, 12, palette.text))
        group.appendChild(rc.line(x + 14, y + h - 16, x + w - 14, y + h - 16, { stroke: palette.line, roughness: 0.7, strokeWidth: 1.2, seed: seed + 1 }) as unknown as SVGElement)
        if (component.kind === 'select') {
          group.appendChild(rc.line(x + w - 28, y + h / 2 - 4, x + w - 18, y + h / 2 + 4, { stroke: palette.line, roughness: 0.8, strokeWidth: 1.4, seed: seed + 2 }) as unknown as SVGElement)
          group.appendChild(rc.line(x + w - 18, y + h / 2 + 4, x + w - 8, y + h / 2 - 4, { stroke: palette.line, roughness: 0.8, strokeWidth: 1.4, seed: seed + 3 }) as unknown as SVGElement)
        }
        break
      case 'textarea':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 14, y + 20, 12, palette.text))
        renderPlaceholderLines(rc, group, seed + 5, x + 14, y + 38, w - 28, 4)
        break
      case 'image':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(rc.line(x + 10, y + 10, x + w - 10, y + h - 10, { stroke: palette.line, roughness: 1.1, strokeWidth: 1.6, seed: seed + 1 }) as unknown as SVGElement)
        group.appendChild(rc.line(x + w - 10, y + 10, x + 10, y + h - 10, { stroke: palette.line, roughness: 1.1, strokeWidth: 1.6, seed: seed + 2 }) as unknown as SVGElement)
        if (component.label) group.appendChild(simpleText(doc, component.label, x + 14, y + 22, 12, palette.text))
        break
      case 'text':
        if (component.label) group.appendChild(simpleText(doc, component.label, x, y + 14, 13, palette.text))
        renderPlaceholderLines(rc, group, seed, x, y + 28, w, 4)
        break
      case 'list':
        if (component.label) group.appendChild(simpleText(doc, component.label, x, y + 14, 13, palette.text))
        for (let i = 0; i < 4; i++) {
          const yy = y + 34 + i * 20
          group.appendChild(rc.ellipse(x + 7, yy - 4, 6, 6, { stroke: palette.line, roughness: 0.8, strokeWidth: 1.2, seed: seed + i }) as unknown as SVGElement)
          group.appendChild(rc.line(x + 18, yy, x + w - 8, yy, { stroke: palette.line, roughness: 0.8, strokeWidth: 1.2, seed: seed + 10 + i }) as unknown as SVGElement)
        }
        break
      case 'checkbox':
        group.appendChild(rc.rectangle(x + 2, y + 6, 18, 18, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 30, y + 20, 12, palette.text))
        if (component.variant === 'checked') {
          group.appendChild(rc.line(x + 6, y + 16, x + 10, y + 20, { stroke: palette.stroke, roughness: 0.8, strokeWidth: 1.8, seed: seed + 1 }) as unknown as SVGElement)
          group.appendChild(rc.line(x + 10, y + 20, x + 17, y + 11, { stroke: palette.stroke, roughness: 0.8, strokeWidth: 1.8, seed: seed + 2 }) as unknown as SVGElement)
        }
        break
      case 'radio':
        group.appendChild(rc.ellipse(x + 11, y + 15, 18, 18, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        if (component.variant === 'checked') {
          group.appendChild(rc.ellipse(x + 11, y + 15, 8, 8, componentOpts(seed + 1, style, palette.stroke, palette.stroke, componentSpirit)) as unknown as SVGElement)
        }
        group.appendChild(simpleText(doc, component.label, x + 30, y + 20, 12, palette.text))
        break
      case 'avatar':
        group.appendChild(rc.ellipse(x + w / 2, y + h / 2, Math.min(w, h), Math.min(w, h), componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(rc.line(x + w * 0.3, y + h * 0.72, x + w * 0.7, y + h * 0.72, { stroke: palette.line, roughness: 0.9, strokeWidth: 1.4, seed: seed + 1 }) as unknown as SVGElement)
        break
      case 'badge':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 12, y + 20, 12, palette.text))
        break
      case 'tabs':
        group.appendChild(rc.line(x, y + 32, x + w, y + 32, { stroke: palette.line, roughness: 0.8, strokeWidth: 1.3, seed }) as unknown as SVGElement)
        for (let i = 0; i < 3; i++) {
          const tabX = x + i * (w / 3)
          group.appendChild(simpleText(doc, i === 0 ? component.label : `Tab ${i + 1}`, tabX + 8, y + 20, 12, palette.text))
          if (i === 0) {
            group.appendChild(rc.line(tabX + 4, y + 32, tabX + w / 3 - 8, y + 32, { stroke: palette.stroke, roughness: 0.7, strokeWidth: 2, seed: seed + i + 3 }) as unknown as SVGElement)
          }
        }
        break
      case 'table':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        for (let i = 1; i < 4; i++) {
          const yy = y + i * (h / 5)
          group.appendChild(rc.line(x, yy, x + w, yy, { stroke: palette.line, roughness: 0.7, strokeWidth: 1.1, seed: seed + i }) as unknown as SVGElement)
        }
        for (let i = 1; i < 3; i++) {
          const xx = x + i * (w / 3)
          group.appendChild(rc.line(xx, y, xx, y + h, { stroke: palette.line, roughness: 0.7, strokeWidth: 1.1, seed: seed + 10 + i }) as unknown as SVGElement)
        }
        group.appendChild(simpleText(doc, component.label, x + 10, y + 18, 12, palette.text))
        break
      case 'modal':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        appendTitle(doc, group, component)
        renderPlaceholderLines(rc, group, seed + 4, x + 20, y + 58, w - 40, 4)
        break
      case 'toast':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, palette.soft, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 14, y + 24, 12, palette.text))
        renderPlaceholderLines(rc, group, seed + 2, x + 14, y + 40, w - 28, 2)
        break
      case 'chart':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, palette.stroke, undefined, componentSpirit)) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 10, y + 18, 12, palette.text))
        for (let i = 0; i < 4; i++) {
          const barW = Math.min(34, w / 8)
          const barH = 30 + i * 18
          const xx = x + 20 + i * (barW + 14)
          const yy = y + h - barH - 18
          group.appendChild(rc.rectangle(xx, yy, barW, barH, componentOpts(seed + i + 1, style, palette.line, palette.soft, componentSpirit)) as unknown as SVGElement)
        }
        break
    }

    if (children.length === 0 && (component.kind === 'panel' || component.kind === 'card' || component.kind === 'column')) {
      renderPlaceholderLines(rc, group, seed + 20, x + 18, y + 44, w - 36, 3)
    }

    layer.appendChild(group)
  }

  svg.appendChild(layer)
}
