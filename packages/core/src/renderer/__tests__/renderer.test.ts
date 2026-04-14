import { describe, it, expect } from 'vitest'
import { renderDiagram } from '../../index.js'

const SIMPLE_DIAGRAM = `td
a(Node A)->b:Node B|connects`

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
    const source = `lr
b:Box
r(Rounded)
c((Circle))
d{Diamond}
y[(Cylinder)]
p:Parallel
h:Hexagon`
    expect(() => renderDiagram(source)).not.toThrow()
    const result = renderDiagram(source)
    expect(result).toContain('<svg')
  })

  it('renders edge styles without throwing', () => {
    const source = `lr
a->b
b=>c
c..>d
a<->e:E`
    expect(() => renderDiagram(source)).not.toThrow()
  })

  it('theme override via options works', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM, { theme: 'clean' })
    expect(result).toContain('<svg')
  })

  it('renders wireframe mode to SVG components', () => {
    const source = `wireframe
screen app:Marketing Page 1280x900
  header top:Top Bar align=between gap=20
    text top_nav:Docs
    tabs top_tabs:Sections span=2
    button cta:Start Trial
  sidebar side_nav:Navigation
    list menu:Primary
  column content:Content
    row stats:Stats gap=22
      card revenue:Revenue span=2
      chart growth:Growth
      panel form:Signup
        select plan:Plan
        checkbox agree:Agree variant=checked
        radio weekly:Weekly variant=checked
        input email:Email
        textarea notes:Notes
      button save:Create`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-components"')
    expect(result).toContain('data-kind="screen"')
    expect(result).toContain('data-kind="button"')
    expect(result).toContain('data-kind="tabs"')
    expect(result).toContain('data-kind="chart"')
  })

  it('renders cross-screen wireframe flows', () => {
    const source = `wireframe
screen one:One 720x560
  panel a:Start
screen two:Two 720x560
  modal b:Confirm
flow one -> two | next`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-wireframe-flows"')
    expect(result).toContain('next')
  })
})
