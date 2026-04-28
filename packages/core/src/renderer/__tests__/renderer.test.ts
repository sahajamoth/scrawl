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

  it('style override via options works', () => {
    const result = renderDiagram(SIMPLE_DIAGRAM, { style: 'architect' })
    expect(result).toContain('<svg')
  })

  it('renders all shipped graph style presets without throwing', () => {
    const source = `lr
a(Start)->b{Check}
b=>c(Done)
b..>d(Error)`
    for (const style of ['sketch', 'rough', 'clean', 'architect', 'blueprint'] as const) {
      expect(() => renderDiagram(source, { style })).not.toThrow()
    }
  })

  it('renders shipped wireframe style presets without throwing', () => {
    const sourceFor = (style: string) => `wireframe
style ${style}
screen app:App 900x700
  panel card:Card
  button cta:Save
flow app -> cta | next`
    for (const style of ['sketch', 'rough', 'clean', 'architect', 'blueprint'] as const) {
      expect(() => renderDiagram(sourceFor(style))).not.toThrow()
    }
  })

  it('uses clean polygon arrowheads for clean style and rough barbs for rough styles', () => {
    const source = `lr
a(Start)->b(End)
b->c(Done)
c->d(Finish)`
    const clean = renderDiagram(source, { style: 'clean' })
    const architect = renderDiagram(source, { style: 'architect' })
    expect(clean).toContain('<polygon')
    expect(architect).not.toContain('<polygon')
  })

  it('applies per-element variation across node strokes', () => {
    const source = `lr
a(Alpha)
b(Beta)
c(Gamma)`
    const result = renderDiagram(source, { style: 'rough' })
    const widths = [...result.matchAll(/stroke-width="([^"]+)"/g)].map(match => match[1])
    expect(new Set(widths).size).toBeGreaterThan(1)
  })

  it('marks a deterministic spirit line element when spirit-line boost is enabled', () => {
    const source = `td
a(Start)->b(Middle)->c(End)
[Cluster: a b c]`
    const result = renderDiagram(source, { style: 'rough' })
    expect(result).toContain('data-spirit-line="true"')
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

  it('renders wireframe flows with explicit route turns', () => {
    const source = `wireframe
screen app:App 900x700
  row top:Top
    card start:Start
    card review:Review
flow start -> review route=up,right,down | guided`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-wireframe-flows"')
    expect(result).toContain('guided')
  })

  it('renders sequence mode with wrapped serpentine rows', () => {
    const source = `sequence wrap=4
style architect
one:One->two:Two->three:Three->four:Four->five:Five->six:Six->seven:Seven->eight:Eight`
    const result = renderDiagram(source)
    expect(result).toContain('<svg')
    expect(result).toContain('class="scrawl-nodes"')
    expect(result).toContain('class="scrawl-edges"')
    expect(result).toContain('One')
    expect(result).toContain('Eight')
  })

  it('renders sequence mode with explicit row breaks', () => {
    const source = `sequence wrap=4
style clean
one:One->two:Two->three:Three
break
four:Four->five:Five`
    const result = renderDiagram(source)
    expect(result).toContain('<svg')
    expect(result).toContain('One')
    expect(result).toContain('Five')
  })

  it('renders sequence mode with labels and spacing options', () => {
    const source = `sequence wrap=3 rowgap=120 colgap=20
style architect
a->b|draft->c|reviewed->d`
    const result = renderDiagram(source)
    expect(result).toContain('<svg')
    expect(result).toContain('draft')
    expect(result).toContain('reviewed')
  })

  it('renders sequence groups and vertical snake layout', () => {
    const source = `sequence wrap=3 snake=vertical
phase setup:Setup
a->b->c
lane review:Review Lane
c->d->e`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-groups"')
    expect(result).toContain('Setup')
    expect(result).toContain('Review Lane')
  })

  it('renders sequence notes', () => {
    const source = `sequence wrap=3
style clean
a->b->c
note right of b:Wait for review
note over c:Deploy window`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-notes"')
    expect(result).toContain('Wait for review')
    expect(result).toContain('Deploy window')
  })
})
