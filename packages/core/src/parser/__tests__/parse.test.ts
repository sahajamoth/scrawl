import { describe, it, expect } from 'vitest'
import { parseDiagram } from '../parse.js'

describe('parseDiagram', () => {
  it('parses a minimal diagram (just [d])', () => {
    const source = `[d]\ntitle = "Minimal"`
    const diagram = parseDiagram(source)
    expect(diagram.meta.title).toBe('Minimal')
    expect(diagram.meta.dir).toBe('td')
    expect(diagram.meta.theme).toBe('rough')
    expect(diagram.nodes).toHaveLength(0)
    expect(diagram.edges).toHaveLength(0)
    expect(diagram.groups).toHaveLength(0)
  })

  it('parses an empty TOML string with defaults', () => {
    const diagram = parseDiagram('')
    expect(diagram.meta.dir).toBe('td')
    expect(diagram.meta.theme).toBe('rough')
  })

  it('parses a full diagram with all node shapes, edge styles, and a group', () => {
    const source = `
[d]
title = "Full"
dir = "lr"
theme = "rough"

[[n]]
id = "a"
l = "Box"
s = "b"
c = "blue"

[[n]]
id = "b"
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
id = "e"
l = "Cylinder"
s = "y"

[[n]]
id = "f"
l = "Parallelogram"
s = "p"

[[n]]
id = "g"
l = "Hexagon"
s = "h"

[[e]]
f = "a"
t = "b"
l = "solid arrow"
st = "solid"
a = "arrow"

[[e]]
f = "b"
t = "c"
st = "dashed"
a = "none"

[[e]]
f = "c"
t = "d"
st = "dotted"
a = "both"

[[g]]
id = "g1"
l = "Backend"
nodes = ["b", "c"]
`
    const diagram = parseDiagram(source)
    expect(diagram.meta.title).toBe('Full')
    expect(diagram.meta.dir).toBe('lr')
    expect(diagram.nodes).toHaveLength(7)
    expect(diagram.edges).toHaveLength(3)
    expect(diagram.groups).toHaveLength(1)

    const boxNode = diagram.nodes.find(n => n.id === 'a')!
    expect(boxNode.shape).toBe('b')
    expect(boxNode.color).toBe('blue')

    const solidEdge = diagram.edges.find(e => e.from === 'a' && e.to === 'b')!
    expect(solidEdge.style).toBe('solid')
    expect(solidEdge.arrow).toBe('arrow')
    expect(solidEdge.label).toBe('solid arrow')

    const dashedEdge = diagram.edges.find(e => e.from === 'b' && e.to === 'c')!
    expect(dashedEdge.style).toBe('dashed')
    expect(dashedEdge.arrow).toBe('none')

    const group = diagram.groups[0]!
    expect(group.id).toBe('g1')
    expect(group.label).toBe('Backend')
    expect(group.nodeIds).toContain('b')
    expect(group.nodeIds).toContain('c')

    // groupId should be set on nodes in the group
    const bNode = diagram.nodes.find(n => n.id === 'b')!
    expect(bNode.groupId).toBe('g1')
  })

  it('throws on duplicate node id', () => {
    const source = `
[[n]]
id = "a"
l = "First"

[[n]]
id = "a"
l = "Second"
`
    expect(() => parseDiagram(source)).toThrow(/[Dd]uplicate node id/)
  })

  it('throws on edge referencing non-existent from node', () => {
    const source = `
[[n]]
id = "a"
l = "A"

[[e]]
f = "x"
t = "a"
`
    expect(() => parseDiagram(source)).toThrow(/unknown node id.*"x"/)
  })

  it('throws on edge referencing non-existent to node', () => {
    const source = `
[[n]]
id = "a"
l = "A"

[[e]]
f = "a"
t = "z"
`
    expect(() => parseDiagram(source)).toThrow(/unknown node id.*"z"/)
  })

  it('throws on group referencing non-existent node', () => {
    const source = `
[[n]]
id = "a"
l = "A"

[[g]]
id = "g1"
nodes = ["a", "missing"]
`
    expect(() => parseDiagram(source)).toThrow(/unknown node id.*"missing"/)
  })

  it('throws on missing required id on node', () => {
    const source = `
[[n]]
l = "No ID"
`
    expect(() => parseDiagram(source)).toThrow()
  })

  it('throws on missing required f on edge', () => {
    const source = `
[[n]]
id = "a"
l = "A"

[[e]]
t = "a"
`
    expect(() => parseDiagram(source)).toThrow()
  })

  it('applies direction and theme defaults', () => {
    const source = `
[[n]]
id = "a"
l = "A"
`
    const diagram = parseDiagram(source)
    expect(diagram.meta.dir).toBe('td')
    expect(diagram.meta.theme).toBe('rough')
    expect(diagram.nodes[0]!.shape).toBe('b')
  })
})
