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

  it('renders sequence fork/join flows and note leaders', () => {
    const source = `sequence wrap=3
style architect
intake->draft
fork draft -> legal:Legal Review, security:Security Review
join legal, security -> approve:Approve
note right of approve:Final sign-off\\nand release window`
    const result = renderDiagram(source)
    expect(result).toContain('Legal Review')
    expect(result).toContain('Security Review')
    expect(result).toContain('Approve')
    expect(result).toContain('data-role="leader"')
  })

  it('renders bar charts to SVG', () => {
    const source = `chart
style blueprint
kind bar
title Revenue by Quarter
xlabel Quarter
ylabel Revenue
categories Q1, Q2, Q3, Q4
series Revenue: 12, 18, 15, 22
series Plan: 10, 14, 16, 20`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-chart"')
    expect(result).toContain('Revenue by Quarter')
    expect(result).toContain('Quarter')
    expect(result).toContain('Revenue')
    expect(result).toContain('Plan')
  })

  it('renders scatter charts deterministically', () => {
    const source = `chart
kind scatter
title Activation vs Retention
series Cohort A: 12,34; 18,29; 24,41; 30,48
series Cohort B: 10,22; 16,26; 20,24; 28,33`
    const first = renderDiagram(source)
    const second = renderDiagram(source)
    expect(first).toContain('class="scrawl-chart"')
    expect(first).toContain('Cohort A')
    expect(first).toBe(second)
  })

  it('renders area charts with legend and grid options', () => {
    const source = `chart
style clean
kind area
legend bottom
grid both
points hide
stack stacked
title Revenue Trend
xlabel Month
ylabel Revenue
categories Jan, Feb, Mar
series Actual: 12, 18, 24
series Plan: 10, 16, 20`
    const result = renderDiagram(source)
    expect(result).toContain('class="scrawl-chart"')
    expect(result).toContain('class="scrawl-chart-legend"')
    expect(result).toContain('Revenue Trend')
    expect(result).toContain('Actual')
    expect(result).toContain('Plan')
  })

  it('renders pie charts and stacked bars', () => {
    const pie = renderDiagram(`chart
kind pie
title Revenue Mix
legend right
categories Product, Services, Support
series Mix: 40, 35, 25`)
    expect(pie).toContain('class="scrawl-chart"')
    expect(pie).toContain('class="scrawl-chart-legend"')
    expect(pie).toContain('Revenue Mix')
    expect(pie).toContain('Product')

    const stacked = renderDiagram(`chart
kind bar
stack stacked
legend top
categories Q1, Q2
series Product: 10, 12
series Services: 8, 9`)
    expect(stacked).toContain('class="scrawl-chart"')
    expect(stacked).toContain('class="scrawl-chart-legend"')
    expect(stacked).toContain('Product')
    expect(stacked).toContain('Services')
  })

  it('renders combo and donut charts with advanced chart controls', () => {
    const combo = renderDiagram(`chart
kind combo
title Revenue vs Conversion
categories Jan, Feb, Mar
labels auto
ref y 20 label=Target color=#ef4444
annotate Feb,24: Peak color=#0f172a
series Revenue [type=bar color=#2563eb]: 12, 18, 24
series Conversion [type=line axis=right color=#16a34a curve=smooth labels=show]: 2.1, 2.8, 3.4`)
    expect(combo).toContain('Revenue vs Conversion')
    expect(combo).toContain('Target')
    expect(combo).toContain('Peak')
    expect(combo).toContain('Conversion')

    const donut = renderDiagram(`chart
kind donut
title Revenue Mix
categories Product, Services, Support
series Mix: 40, 35, 25`)
    expect(donut).toContain('Revenue Mix')
    expect(donut).toContain('Product')
    expect(donut).toContain('class="scrawl-chart"')
  })

  it('renders heatmap, sankey, treemap, and gauge charts', () => {
    const heatmap = renderDiagram(`chart
kind heatmap
title Reliability Matrix
cell API,Mon: 91
cell API,Tue: 88
cell Web,Mon: 94`)
    expect(heatmap).toContain('Reliability Matrix')
    expect(heatmap).toContain('API')
    expect(heatmap).toContain('Mon')

    const sankey = renderDiagram(`chart
kind sankey
title Pipeline Flow
flow leads -> demo: 48
flow demo -> won: 18`)
    expect(sankey).toContain('Pipeline Flow')
    expect(sankey).toContain('leads')
    expect(sankey).toContain('demo')

    const treemap = renderDiagram(`chart
kind treemap
title Portfolio Mix
item Product/API: 32
item Product/Web: 24`)
    expect(treemap).toContain('Portfolio Mix')
    expect(treemap).toContain('API')

    const gauge = renderDiagram(`chart
kind gauge
title SLA Health
ymin 0
ymax 100
threshold 60 #16a34a Good
threshold 85 #f59e0b Watch
threshold 100 #dc2626 Critical
series Health: 72`)
    expect(gauge).toContain('SLA Health')
    expect(gauge).toContain('Good')
  })
})
