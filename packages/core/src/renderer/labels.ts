import { seededRandom } from '../layout/seed.js'
import type { RenderStyle } from './styles.js'

type XmlDoc = { createElementNS: (ns: string | null, tag: string) => Element }

interface LabelVariance {
  dy: string
  rotate: string
  dx: string
  fontSize: number
  letterSpacing: string
  x: number
  y: number
  tilt: number
}

function wobbleOffsets(text: string, seed: number, amount: number): LabelVariance {
  const dyValues: number[] = [0]  // first char stays on baseline
  const rotValues: number[] = [0] // first char unrotated
  const dxValues: number[] = [0]
  for (let i = 1; i < text.length; i++) {
    const dyRand = seededRandom(seed + text.charCodeAt(i), i * 2)
    const rotRand = seededRandom(seed + text.charCodeAt(i), i * 2 + 1)
    const dxRand = seededRandom(seed + text.charCodeAt(i), i * 2 + 2)
    dyValues.push((dyRand - 0.5) * 2 * amount)
    rotValues.push((rotRand - 0.5) * 2 * amount * 1.5)
    dxValues.push((dxRand - 0.35) * amount * 0.5)
  }
  const sizeRand = seededRandom(seed, 91)
  const spacingRand = seededRandom(seed, 92)
  const xRand = seededRandom(seed, 93)
  const yRand = seededRandom(seed, 94)
  const tiltRand = seededRandom(seed, 95)
  return {
    dy: dyValues.map(v => v.toFixed(1)).join(' '),
    rotate: rotValues.map(v => v.toFixed(1)).join(' '),
    dx: dxValues.map(v => v.toFixed(2)).join(' '),
    fontSize: 1 + (sizeRand - 0.5) * amount * 0.08,
    letterSpacing: `${((spacingRand - 0.5) * amount * 0.03).toFixed(3)}em`,
    x: (xRand - 0.5) * 2 * amount * 1.2,
    y: (yRand - 0.5) * 2 * amount * 1.2,
    tilt: (tiltRand - 0.5) * 2 * amount * 1.4,
  }
}

export function createLabel(
  doc: XmlDoc,
  text: string,
  x: number,
  y: number,
  fontSize = 16,
  seed?: number,
  style?: RenderStyle,
): SVGElement {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('class', 'scrawl-label')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('text-anchor', 'middle')
  el.setAttribute('dominant-baseline', 'central')
  el.setAttribute('font-family', '"Permanent Marker", cursive')
  el.setAttribute('font-size', String(fontSize))
  el.setAttribute('fill', '#1a202c')

  const useWobble = style?.textWobble && seed != null

  const lines = text.split('\\n')
  if (lines.length === 1) {
    if (useWobble) {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      const offsets = wobbleOffsets(text, seed!, style!.textWobbleAmount)
      el.setAttribute('x', (x + offsets.x).toFixed(1))
      el.setAttribute('y', (y + offsets.y).toFixed(1))
      el.setAttribute('font-size', (fontSize * offsets.fontSize).toFixed(2))
      el.setAttribute('letter-spacing', offsets.letterSpacing)
      el.setAttribute('transform', `rotate(${offsets.tilt.toFixed(1)} ${(x + offsets.x).toFixed(1)} ${(y + offsets.y).toFixed(1)})`)
      tspan.setAttribute('dx', offsets.dx)
      tspan.setAttribute('dy', offsets.dy)
      tspan.setAttribute('rotate', offsets.rotate)
      tspan.textContent = text
      el.appendChild(tspan)
    } else {
      el.textContent = text
    }
  } else {
    const lineH = fontSize * 1.3
    const startY = y - ((lines.length - 1) * lineH) / 2
    let block: LabelVariance | undefined
    if (useWobble) {
      block = wobbleOffsets(text, seed!, style!.textWobbleAmount)
      el.setAttribute('x', (x + block.x).toFixed(1))
      el.setAttribute('y', (y + block.y).toFixed(1))
      el.setAttribute('font-size', (fontSize * block.fontSize).toFixed(2))
      el.setAttribute('letter-spacing', block.letterSpacing)
      el.setAttribute('transform', `rotate(${block.tilt.toFixed(1)} ${(x + block.x).toFixed(1)} ${(y + block.y).toFixed(1)})`)
    }
    for (let i = 0; i < lines.length; i++) {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      if (useWobble) {
        const offsets = wobbleOffsets(lines[i]!, seed! + i, style!.textWobbleAmount)
        tspan.setAttribute('x', (x + block!.x).toFixed(1))
        tspan.setAttribute('y', (startY + block!.y + i * lineH).toFixed(1))
        tspan.setAttribute('dx', offsets.dx)
        tspan.setAttribute('dy', offsets.dy)
        tspan.setAttribute('rotate', offsets.rotate)
      } else {
        tspan.setAttribute('x', String(x))
        tspan.setAttribute('y', String(startY + i * lineH))
      }
      tspan.textContent = lines[i]!
      el.appendChild(tspan)
    }
  }
  return el as unknown as SVGElement
}

export function createEdgeLabel(
  doc: XmlDoc,
  text: string,
  x: number,
  y: number,
  seed?: number,
  style?: RenderStyle,
): SVGElement {
  return createLabel(doc, text, x, y, 13, seed, style)
}
