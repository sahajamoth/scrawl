import type { RoughSVG } from 'roughjs/bin/svg.js'
import type { LayoutComponent, LayoutResult } from '../ir/types.js'
import { createLabel } from './labels.js'
import type { RenderStyle } from './styles.js'
import { deriveSeed, seededRandom } from '../layout/seed.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDoc = any

function childComponents(layout: LayoutResult, parentId: string): LayoutComponent[] {
  return (layout.components ?? []).filter(component => component.parentId === parentId)
}

function componentOpts(seed: number, style: RenderStyle, stroke = '#2d3748', fill?: string) {
  return {
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

export function renderWireframe(
  doc: AnyDoc,
  svg: SVGSVGElement,
  rc: RoughSVG,
  layout: LayoutResult,
  style: RenderStyle,
) {
  const layer = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  layer.setAttribute('class', 'scrawl-components')

  const components = layout.components ?? []
  for (const component of components) {
    const seed = deriveSeed(layout.seed, component.id)
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('data-kind', component.kind)
    group.setAttribute('data-id', component.id)

    const x = component.x
    const y = component.y
    const w = component.width
    const h = component.height
    const children = childComponents(layout, component.id)

    switch (component.kind) {
      case 'screen':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#1f2937', '#f8fafc')) as unknown as SVGElement)
        if (component.label) {
          const title = createLabel(doc, component.label, x + w / 2, y + 18, 16, seed, style)
          title.setAttribute('fill', '#4a5568')
          group.appendChild(title)
        }
        break
      case 'header':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#4a5568', '#edf2f7')) as unknown as SVGElement)
        break
      case 'sidebar':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#718096', '#f7fafc')) as unknown as SVGElement)
        appendTitle(doc, group, component)
        break
      case 'panel':
      case 'card':
      case 'column':
      case 'row':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#4a5568', component.kind === 'card' ? '#ffffff' : '#f8fafc')) as unknown as SVGElement)
        if (component.kind !== 'row') appendTitle(doc, group, component)
        break
      case 'button': {
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#2d3748', '#e2e8f0')) as unknown as SVGElement)
        const label = createLabel(doc, component.label, x + w / 2, y + h / 2 + 1, 15, seed, style)
        group.appendChild(label)
        break
      }
      case 'input':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#4a5568')) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 14, y + 20, 12))
        group.appendChild(rc.line(x + 14, y + h - 16, x + w - 14, y + h - 16, { stroke: '#a0aec0', roughness: 0.7, strokeWidth: 1.2, seed: seed + 1 }) as unknown as SVGElement)
        break
      case 'textarea':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#4a5568')) as unknown as SVGElement)
        group.appendChild(simpleText(doc, component.label, x + 14, y + 20, 12))
        renderPlaceholderLines(rc, group, seed + 5, x + 14, y + 38, w - 28, 4)
        break
      case 'image':
        group.appendChild(rc.rectangle(x, y, w, h, componentOpts(seed, style, '#4a5568')) as unknown as SVGElement)
        group.appendChild(rc.line(x + 10, y + 10, x + w - 10, y + h - 10, { stroke: '#718096', roughness: 1.1, strokeWidth: 1.6, seed: seed + 1 }) as unknown as SVGElement)
        group.appendChild(rc.line(x + w - 10, y + 10, x + 10, y + h - 10, { stroke: '#718096', roughness: 1.1, strokeWidth: 1.6, seed: seed + 2 }) as unknown as SVGElement)
        if (component.label) group.appendChild(simpleText(doc, component.label, x + 14, y + 22, 12))
        break
      case 'text':
        if (component.label) group.appendChild(simpleText(doc, component.label, x, y + 14, 13))
        renderPlaceholderLines(rc, group, seed, x, y + 28, w, 4)
        break
      case 'list':
        if (component.label) group.appendChild(simpleText(doc, component.label, x, y + 14, 13))
        for (let i = 0; i < 4; i++) {
          const yy = y + 34 + i * 20
          group.appendChild(rc.ellipse(x + 7, yy - 4, 6, 6, { stroke: '#718096', roughness: 0.8, strokeWidth: 1.2, seed: seed + i }) as unknown as SVGElement)
          group.appendChild(rc.line(x + 18, yy, x + w - 8, yy, { stroke: '#718096', roughness: 0.8, strokeWidth: 1.2, seed: seed + 10 + i }) as unknown as SVGElement)
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
