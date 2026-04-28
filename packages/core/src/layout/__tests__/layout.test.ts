import { describe, expect, it } from 'vitest'
import { parseDiagram } from '../../parser/parse.js'
import { layoutDiagram } from '../layout.js'

describe('layoutDiagram wireframe flow routing', () => {
  it('preserves explicit route turns for wireframe flows', () => {
    const source = `wireframe
screen app:App 720x560
  row top:Top
    card a:Alpha
    card b:Beta
flow a -> b route=up,right,down | detour`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const flow = layout.flows?.[0]

    expect(flow?.label).toBe('detour')
    expect(flow?.route).toEqual([
      { direction: 'up' },
      { direction: 'right' },
      { direction: 'down' },
    ])
    expect(flow?.points.length).toBeGreaterThanOrEqual(5)

    const [start, up, right, down] = flow!.points
    expect(up[1]).toBeLessThan(start[1])
    expect(right[0]).toBeGreaterThan(up[0])
    expect(down[1]).toBeGreaterThan(right[1])
  })

  it('expands bounds for left/up explicit routes instead of clipping them', () => {
    const source = `wireframe
screen app:App 720x560
  row top:Top
    card a:Alpha
    card b:Beta
flow b -> a turns=left,up,left`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const points = layout.flows?.[0]?.points ?? []
    const minX = Math.min(...points.map(point => point[0]))
    const minY = Math.min(...points.map(point => point[1]))

    expect(minX).toBeGreaterThanOrEqual(40)
    expect(minY).toBeGreaterThanOrEqual(40)
  })

  it('supports custom route distances for wireframe flows', () => {
    const source = `wireframe
screen app:App 720x560
  row top:Top
    card a:Alpha
    card b:Beta
flow a -> b route=up:120,right*2,down`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const flow = layout.flows?.[0]
    expect(flow?.route).toEqual([
      { direction: 'up', distance: 120 },
      { direction: 'right' },
      { direction: 'right' },
      { direction: 'down' },
    ])
    expect(flow!.points[1]![1]).toBe(flow!.points[0]![1] - 120)
    expect(flow!.points[3]![0]).toBe(flow!.points[1]![0] + 144)
  })
})

describe('layoutDiagram sequence routing', () => {
  it('wraps sequence nodes in serpentine rows when wrap is set', () => {
    const source = `sequence wrap=4
one:One->two:Two->three:Three->four:Four->five:Five->six:Six`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const nodes = new Map(layout.nodes.map(node => [node.id, node]))

    expect(layout.meta.kind).toBe('sequence')
    expect(nodes.get('one')!.y).toBe(nodes.get('four')!.y)
    expect(nodes.get('five')!.y).toBe(nodes.get('six')!.y)
    expect(nodes.get('five')!.y).toBeGreaterThan(nodes.get('one')!.y)

    expect(nodes.get('one')!.x).toBeLessThan(nodes.get('two')!.x)
    expect(nodes.get('two')!.x).toBeLessThan(nodes.get('three')!.x)
    expect(nodes.get('three')!.x).toBeLessThan(nodes.get('four')!.x)
    expect(nodes.get('five')!.x).toBeGreaterThan(nodes.get('six')!.x)

    const edge = layout.edges.find(item => item.from === 'four' && item.to === 'five')
    expect(edge).toBeDefined()
    expect(edge!.points[0]![0]).toBe(edge!.points[1]![0])
    expect(edge!.points[0]![1]).toBeLessThan(edge!.points[1]![1])
  })

  it('starts a new serpentine row at explicit sequence breaks', () => {
    const source = `sequence wrap=4
one:One->two:Two->three:Three
break
four:Four->five:Five`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const nodes = new Map(layout.nodes.map(node => [node.id, node]))

    expect(nodes.get('one')!.y).toBe(nodes.get('three')!.y)
    expect(nodes.get('four')!.y).toBe(nodes.get('five')!.y)
    expect(nodes.get('four')!.y).toBeGreaterThan(nodes.get('one')!.y)
    expect(nodes.get('four')!.x).toBeGreaterThan(nodes.get('five')!.x)
  })

  it('uses sequence rowgap and colgap header options', () => {
    const source = `sequence wrap=2 rowgap=120 colgap=20
one:One->two:Two->three:Three`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const nodes = new Map(layout.nodes.map(node => [node.id, node]))

    expect(nodes.get('two')!.x - nodes.get('one')!.x).toBe(160)
    expect(nodes.get('three')!.y - nodes.get('one')!.y).toBe(175)
  })

  it('supports vertical serpentine sequence layout', () => {
    const source = `sequence wrap=3 snake=vertical
one:One->two:Two->three:Three->four:Four->five:Five`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const nodes = new Map(layout.nodes.map(node => [node.id, node]))

    expect(nodes.get('one')!.x).toBe(nodes.get('three')!.x)
    expect(nodes.get('four')!.x).toBeGreaterThan(nodes.get('one')!.x)
    expect(nodes.get('one')!.y).toBeLessThan(nodes.get('two')!.y)
    expect(nodes.get('two')!.y).toBeLessThan(nodes.get('three')!.y)
    expect(nodes.get('four')!.y).toBeGreaterThan(nodes.get('five')!.y)
  })

  it('computes layout groups for sequence phases and lanes', () => {
    const source = `sequence wrap=4
phase setup:Setup
a->b->c
lane review:Review Lane
c->d->e`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)

    expect(layout.groups).toHaveLength(2)
    expect(layout.groups[0]?.label).toBe('Setup')
    expect(layout.groups[1]?.label).toBe('Review Lane')
    expect(layout.groups[0]!.width).toBeGreaterThan(0)
    expect(layout.groups[1]!.height).toBeGreaterThan(0)
  })

  it('positions sequence notes around their target steps', () => {
    const source = `sequence wrap=3
a->b->c
note right of b:Wait for review
note over c:Deploy window`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const nodes = new Map(layout.nodes.map(node => [node.id, node]))
    const rightNote = layout.notes?.find(note => note.target === 'b')
    const overNote = layout.notes?.find(note => note.target === 'c')

    expect(rightNote).toBeDefined()
    expect(overNote).toBeDefined()
    expect(rightNote!.x).toBeGreaterThan(nodes.get('b')!.x)
    expect(overNote!.y).toBeLessThan(nodes.get('c')!.y)
  })

  it('routes fork and join edges with separated branch ports', () => {
    const source = `sequence wrap=3
intake->draft
fork draft -> legal:Legal Review, security:Security Review
join legal, security -> approve:Approve`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const toLegal = layout.edges.find(edge => edge.from === 'draft' && edge.to === 'legal')
    const toSecurity = layout.edges.find(edge => edge.from === 'draft' && edge.to === 'security')
    const toApproveFromLegal = layout.edges.find(edge => edge.from === 'legal' && edge.to === 'approve')
    const toApproveFromSecurity = layout.edges.find(edge => edge.from === 'security' && edge.to === 'approve')

    expect(toLegal).toBeDefined()
    expect(toSecurity).toBeDefined()
    expect(toApproveFromLegal).toBeDefined()
    expect(toApproveFromSecurity).toBeDefined()
    expect(toLegal!.points[0]![0]).not.toBe(toSecurity!.points[0]![0])
    expect(toApproveFromLegal!.points.at(-1)![0]).not.toBe(toApproveFromSecurity!.points.at(-1)![0])
  })

  it('adds leader points for sequence notes', () => {
    const source = `sequence wrap=3
a->b->c
note right of b:Wait for reviewer\\nand compliance`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)
    const note = layout.notes?.[0]

    expect(note).toBeDefined()
    expect(note!.leaderPoints).toBeDefined()
    expect(note!.leaderPoints!.length).toBeGreaterThanOrEqual(4)
    expect(note!.leaderPoints![0]![0]).toBeLessThan(note!.leaderPoints!.at(-1)![0])
  })
})

describe('layoutDiagram chart mode', () => {
  it('builds chart plot bounds for bar charts', () => {
    const source = `chart
kind bar
categories Q1, Q2, Q3
series Revenue: 12, 18, 15`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)

    expect(layout.meta.kind).toBe('chart')
    expect(layout.chart).toBeDefined()
    expect(layout.chart?.plotWidth).toBeGreaterThan(0)
    expect(layout.chart?.plotHeight).toBeGreaterThan(0)
    expect(layout.chart?.minY).toBe(0)
    expect(layout.chart?.maxY).toBe(18)
    expect(layout.width).toBeGreaterThan(layout.chart!.plotX + layout.chart!.plotWidth)
  })

  it('pads scatter chart axes around point ranges', () => {
    const source = `chart
kind scatter
series Cohort A: 12,34; 18,29; 24,41`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)

    expect(layout.chart?.kind).toBe('scatter')
    expect(layout.chart!.minX).toBeLessThan(12)
    expect(layout.chart!.maxX).toBeGreaterThan(24)
    expect(layout.chart!.minY).toBeLessThan(29)
    expect(layout.chart!.maxY).toBeGreaterThan(41)
  })

  it('respects chart legend placement and explicit axis options', () => {
    const source = `chart
kind area
legend bottom
grid both
stack stacked
yticks 6
ymin 0
ymax 40
categories Jan, Feb, Mar
series Revenue: 12, 18, 24`

    const diagram = parseDiagram(source)
    const layout = layoutDiagram(diagram, source)

    expect(layout.chart?.kind).toBe('area')
    expect(layout.chart?.legend).toBe('bottom')
    expect(layout.chart?.grid).toBe('both')
    expect(layout.chart?.stack).toBe('stacked')
    expect(layout.chart?.minY).toBe(0)
    expect(layout.chart?.maxY).toBe(40)
    expect(layout.chart?.yTicks.length).toBeGreaterThanOrEqual(2)
    expect(layout.chart?.xTicks.map(tick => tick.label)).toEqual(['Jan', 'Feb', 'Mar'])
  })

  it('uses stacked extents for stacked bar charts and keeps pie axis-free', () => {
    const stackedSource = `chart
kind bar
stack stacked
categories Q1, Q2
series Product: 10, 12
series Services: 8, 9`
    const stackedLayout = layoutDiagram(parseDiagram(stackedSource), stackedSource)

    expect(stackedLayout.chart?.stack).toBe('stacked')
    expect(stackedLayout.chart?.maxY).toBeGreaterThanOrEqual(20)

    const pieSource = `chart
kind pie
categories Product, Services, Support
series Mix: 40, 35, 25`
    const pieLayout = layoutDiagram(parseDiagram(pieSource), pieSource)

    expect(pieLayout.chart?.kind).toBe('pie')
    expect(pieLayout.chart?.xTicks).toEqual([])
    expect(pieLayout.chart?.yTicks).toEqual([])
  })

  it('builds secondary-axis ticks for combo charts and percent extents for stacked percent bars', () => {
    const comboSource = `chart
kind combo
categories Jan, Feb, Mar
y2ticks 4
series Revenue [type=bar]: 12, 18, 24
series Conversion [type=line axis=right]: 2.1, 2.8, 3.4`
    const comboLayout = layoutDiagram(parseDiagram(comboSource), comboSource)

    expect(comboLayout.chart?.kind).toBe('combo')
    expect(comboLayout.chart?.y2Ticks?.length).toBeGreaterThanOrEqual(2)
    expect(comboLayout.chart?.minY2).toBeLessThanOrEqual(2.1)
    expect(comboLayout.chart?.maxY2).toBeGreaterThanOrEqual(3.4)

    const percentSource = `chart
kind bar
stack percent
categories Q1, Q2
series Product: 60, 55
series Services: 40, 45`
    const percentLayout = layoutDiagram(parseDiagram(percentSource), percentSource)
    expect(percentLayout.chart?.maxY).toBe(100)
  })

  it('derives heatmap axes from cells and keeps sankey axis-free', () => {
    const heatmapSource = `chart
kind heatmap
cell API,Mon: 91
cell API,Tue: 88
cell Web,Mon: 94`
    const heatmapLayout = layoutDiagram(parseDiagram(heatmapSource), heatmapSource)
    expect(heatmapLayout.chart?.xTicks.map(tick => tick.label)).toEqual(['Mon', 'Tue'])
    expect(heatmapLayout.chart?.yTicks.map(tick => tick.label)).toEqual(['API', 'Web'])

    const sankeySource = `chart
kind sankey
flow leads -> demo: 48
flow demo -> won: 18`
    const sankeyLayout = layoutDiagram(parseDiagram(sankeySource), sankeySource)
    expect(sankeyLayout.chart?.xTicks).toEqual([])
    expect(sankeyLayout.chart?.yTicks).toEqual([])
  })
})
