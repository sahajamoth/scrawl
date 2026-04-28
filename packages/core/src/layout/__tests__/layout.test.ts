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
})
