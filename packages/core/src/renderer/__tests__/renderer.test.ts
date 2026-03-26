import { describe, it, expect } from 'vitest'
import { renderDiagram } from '../../index.js'

const SIMPLE_DIAGRAM = `
[d]
title = "Test"
dir = "td"

[[n]]
id = "a"
l = "Node A"
s = "b"

[[n]]
id = "b"
l = "Node B"
s = "r"

[[e]]
f = "a"
t = "b"
l = "connects"
`

describe('renderDiagram', () => {
  it('returns a string containing <svg for a simple 2-node diagram', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM)
    expect(typeof result).toBe('string')
    expect(result).toContain('<svg')
  })

  it('rendered SVG contains class="scrawl-nodes"', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM)
    expect(result).toContain('class="scrawl-nodes"')
  })

  it('rendered SVG contains class="scrawl-edges"', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM)
    expect(result).toContain('class="scrawl-edges"')
  })

  it('produces deterministic output: same input yields same SVG', () => {
    const result1 = renderDiagram(SIMPLE_DIAGRAM)
    const result2 = renderDiagram(SIMPLE_DIAGRAM)
    expect(result1).toBe(result2)
  })

  it('renders all node shapes without throwing', () => {
    const source = `
[[n]]
id = "b"
l = "Box"
s = "b"

[[n]]
id = "r"
l = "Rounded"
s = "r"

[[n]]
id = "c"
l = "Circle"
s = "c"

[[n]]
id = "d"
l = "Diamond"
s = "d"

[[n]]
id = "y"
l = "Cylinder"
s = "y"

[[n]]
id = "p"
l = "Para"
s = "p"

[[n]]
id = "h"
l = "Hex"
s = "h"
`
    expect(() => renderDiagram(source)).not.toThrow()
    const result = renderDiagram(source)
    expect(result).toContain('<svg')
  })

  it('renders edge styles without throwing', () => {
    const source = `
[[n]]
id = "a"
l = "A"

[[n]]
id = "b"
l = "B"

[[n]]
id = "c"
l = "C"

[[e]]
f = "a"
t = "b"
st = "dashed"

[[e]]
f = "b"
t = "c"
st = "dotted"
a = "both"
`
    expect(() => renderDiagram(source)).not.toThrow()
  })

  it('theme override via options works', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM, { theme: 'clean' })
    expect(result).toContain('<svg')
  })
})
