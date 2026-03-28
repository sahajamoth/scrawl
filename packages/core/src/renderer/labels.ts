import { seededRandom } from '../layout/seed.js'
import type { RenderStyle } from './styles.js'

type XmlDoc = { createElementNS: (ns: string | null, tag: string) => Element }

function wobbleOffsets(text: string, seed: number, amount: number): { dy: string; rotate: string } {
  const dyValues: number[] = [0]  // first char stays on baseline
  const rotValues: number[] = [0] // first char unrotated
  for (let i = 1; i < text.length; i++) {
    const dyRand = seededRandom(seed + text.charCodeAt(i), i * 2)
    const rotRand = seededRandom(seed + text.charCodeAt(i), i * 2 + 1)
    dyValues.push((dyRand - 0.5) * 2 * amount)
    rotValues.push((rotRand - 0.5) * 2 * amount * 1.5)
  }
  return {
    dy: dyValues.map(v => v.toFixed(1)).join(' '),
    rotate: rotValues.map(v => v.toFixed(1)).join(' '),
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
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('text-anchor', 'middle')
  el.setAttribute('dominant-baseline', 'central')
  el.setAttribute('font-family', 'Caveat, cursive')
  el.setAttribute('font-size', String(fontSize))
  el.setAttribute('fill', '#1a202c')

  const useWobble = style?.textWobble && seed != null

  const lines = text.split('\\n')
  if (lines.length === 1) {
    if (useWobble) {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      const offsets = wobbleOffsets(text, seed!, style!.textWobbleAmount)
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
    for (let i = 0; i < lines.length; i++) {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      tspan.setAttribute('x', String(x))
      tspan.setAttribute('y', String(startY + i * lineH))
      if (useWobble) {
        const offsets = wobbleOffsets(lines[i]!, seed! + i, style!.textWobbleAmount)
        tspan.setAttribute('dy', offsets.dy)
        tspan.setAttribute('rotate', offsets.rotate)
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
