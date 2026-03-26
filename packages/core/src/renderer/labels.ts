type XmlDoc = { createElementNS: (ns: string | null, tag: string) => Element }

export function createLabel(doc: XmlDoc, text: string, x: number, y: number, fontSize = 16): SVGElement {
  const el = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('text-anchor', 'middle')
  el.setAttribute('dominant-baseline', 'central')
  el.setAttribute('font-family', 'Caveat, cursive')
  el.setAttribute('font-size', String(fontSize))
  el.setAttribute('fill', '#1a202c')

  // Handle multiline via \n
  const lines = text.split('\\n')
  if (lines.length === 1) {
    el.textContent = text
  } else {
    const lineH = fontSize * 1.3
    const startY = y - ((lines.length - 1) * lineH) / 2
    for (let i = 0; i < lines.length; i++) {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan')
      tspan.setAttribute('x', String(x))
      tspan.setAttribute('y', String(startY + i * lineH))
      tspan.textContent = lines[i]!
      el.appendChild(tspan)
    }
  }
  return el as unknown as SVGElement
}

export function createEdgeLabel(doc: XmlDoc, text: string, x: number, y: number): SVGElement {
  return createLabel(doc, text, x, y, 13)
}
