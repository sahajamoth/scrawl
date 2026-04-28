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
