import { describe, it, expect } from 'vitest'
import { parseDiagram } from '../parse.js'

describe('parseDiagram', () => {
  it('empty string → defaults (dir: lr, theme: rough, empty nodes/edges/groups)', () => {
    const diagram = parseDiagram('')
    expect(diagram.meta.dir).toBe('lr')
    expect(diagram.meta.theme).toBe('rough')
    expect(diagram.nodes).toHaveLength(0)
    expect(diagram.edges).toHaveLength(0)
    expect(diagram.groups).toHaveLength(0)
  })

  it('direction-only line sets direction', () => {
    const diagram = parseDiagram('td')
    expect(diagram.meta.dir).toBe('td')
  })

  it('simple chain a->b->c → 3 nodes (bare ids, box shape), 2 edges', () => {
    const diagram = parseDiagram('a->b->c')
    expect(diagram.nodes).toHaveLength(3)
    expect(diagram.edges).toHaveLength(2)
    const ids = diagram.nodes.map(n => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).toContain('c')
    // bare id nodes default to box shape
    diagram.nodes.forEach(n => expect(n.shape).toBe('b'))
    expect(diagram.edges[0]).toMatchObject({ from: 'a', to: 'b' })
    expect(diagram.edges[1]).toMatchObject({ from: 'b', to: 'c' })
  })

  it('all node forms: bare id, colon-label, (rounded), ((circle)), {diamond}, [(cylinder)]', () => {
    const source = [
      'bare',
      'col:Label',
      'rnd(Rounded)',
      'cir((Circle))',
      'dia{Diamond}',
      'cyl[(Cylinder)]',
    ].join('\n')
    const diagram = parseDiagram(source)
    expect(diagram.nodes).toHaveLength(6)

    const bare = diagram.nodes.find(n => n.id === 'bare')!
    expect(bare.shape).toBe('b')

    const col = diagram.nodes.find(n => n.id === 'col')!
    expect(col.label).toBe('Label')
    expect(col.shape).toBe('b')

    const rnd = diagram.nodes.find(n => n.id === 'rnd')!
    expect(rnd.label).toBe('Rounded')
    expect(rnd.shape).toBe('r')

    const cir = diagram.nodes.find(n => n.id === 'cir')!
    expect(cir.label).toBe('Circle')
    expect(cir.shape).toBe('c')

    const dia = diagram.nodes.find(n => n.id === 'dia')!
    expect(dia.label).toBe('Diamond')
    expect(dia.shape).toBe('d')

    const cyl = diagram.nodes.find(n => n.id === 'cyl')!
    expect(cyl.label).toBe('Cylinder')
    expect(cyl.shape).toBe('y')
  })

  it('color: a:API~blue → node has color blue', () => {
    const diagram = parseDiagram('a:API~blue')
    const node = diagram.nodes.find(n => n.id === 'a')!
    expect(node.label).toBe('API')
    expect(node.color).toBe('blue')
  })

  it('all edge types: ->, =>, ..>, ---, <->', () => {
    const source = [
      'a->b',
      'b=>c',
      'c..>d',
      'd---e',
      'e<->f',
    ].join('\n')
    const diagram = parseDiagram(source)

    const solid = diagram.edges.find(e => e.from === 'a' && e.to === 'b')!
    expect(solid.style).toBe('solid')
    expect(solid.arrow).toBe('arrow')

    const dashed = diagram.edges.find(e => e.from === 'b' && e.to === 'c')!
    expect(dashed.style).toBe('dashed')

    const dotted = diagram.edges.find(e => e.from === 'c' && e.to === 'd')!
    expect(dotted.style).toBe('dotted')

    const line = diagram.edges.find(e => e.from === 'd' && e.to === 'e')!
    expect(line.arrow).toBe('none')

    const bidir = diagram.edges.find(e => e.from === 'e' && e.to === 'f')!
    expect(bidir.arrow).toBe('both')
  })

  it('edge with label: a->b|verify → edge has label verify', () => {
    const diagram = parseDiagram('a->b|verify')
    const edge = diagram.edges.find(e => e.from === 'a' && e.to === 'b')!
    expect(edge.label).toBe('verify')
  })

  it('chain edge labels: a->b|draft->c|reviewed keeps labels on each edge', () => {
    const diagram = parseDiagram('a->b|draft->c|reviewed')
    expect(diagram.edges).toEqual([
      { from: 'a', to: 'b', label: 'draft', style: 'solid', arrow: 'arrow' },
      { from: 'b', to: 'c', label: 'reviewed', style: 'solid', arrow: 'arrow' },
    ])
  })

  it('fan-out: a->{b,c,d} → 3 edges from a', () => {
    const diagram = parseDiagram('a->{b,c,d}')
    const edgesFromA = diagram.edges.filter(e => e.from === 'a')
    expect(edgesFromA).toHaveLength(3)
    const targets = edgesFromA.map(e => e.to)
    expect(targets).toContain('b')
    expect(targets).toContain('c')
    expect(targets).toContain('d')
  })

  it('group: [Backend: b c] → group with label Backend', () => {
    const source = 'b\nc\n[Backend: b c]'
    const diagram = parseDiagram(source)
    expect(diagram.groups).toHaveLength(1)
    const group = diagram.groups[0]!
    expect(group.label).toBe('Backend')
    expect(group.nodeIds).toContain('b')
    expect(group.nodeIds).toContain('c')
  })

  it('group with explicit id: [g1|Backend: b c] → group id=g1', () => {
    const source = 'b\nc\n[g1|Backend: b c]'
    const diagram = parseDiagram(source)
    const group = diagram.groups[0]!
    expect(group.id).toBe('g1')
    expect(group.label).toBe('Backend')
    expect(group.nodeIds).toContain('b')
    expect(group.nodeIds).toContain('c')
  })

  it('node attrs defined on first occurrence only — second mention in chain does not redefine', () => {
    // a is first defined as rounded; then referenced bare in a chain — shape must stay rounded
    const source = 'a(MyLabel)\na->b'
    const diagram = parseDiagram(source)
    const node = diagram.nodes.find(n => n.id === 'a')!
    expect(node.shape).toBe('r')
    expect(node.label).toBe('MyLabel')
  })

  it('throws on duplicate node id (same id with different attrs twice)', () => {
    const source = 'a:First\na:Second'
    expect(() => parseDiagram(source)).toThrow(/[Dd]uplicate node id/)
  })

  it('throws on group referencing unknown node id', () => {
    const source = 'a\n[Backend: a missing]'
    expect(() => parseDiagram(source)).toThrow(/unknown node id.*"missing"/)
  })

  it('parses wireframe components from indentation-based syntax', () => {
    const source = `wireframe
style architect
screen app:Dashboard 1280x900
  header top:Main Header align=between gap=24
    text top_nav:Overview
    button invite:Invite
  sidebar side_nav:Primary Nav w=240
    list menu:Main Menu
  column content:Content
    row stats:Stats gap=24
      card revenue:Revenue span=2
      card churn:Churn
    panel form:Lead Form
      input email:Email
      button save:Save
screen mobile:Mobile 390x844
  modal confirm:Confirm
flow app -> mobile | handoff`
    const diagram = parseDiagram(source)
    expect(diagram.meta.kind).toBe('wireframe')
    expect(diagram.meta.style).toBe('architect')
    expect(diagram.components).toBeDefined()
    expect(diagram.nodes).toHaveLength(0)
    const screen = diagram.components?.find(component => component.id === 'app')
    expect(screen?.kind).toBe('screen')
    expect(screen?.width).toBe(1280)
    const stats = diagram.components?.find(component => component.id === 'stats')
    expect(stats?.gap).toBe(24)
    const revenue = diagram.components?.find(component => component.id === 'revenue')
    expect(revenue?.span).toBe(2)
    const save = diagram.components?.find(component => component.id === 'save')
    expect(save?.parentId).toBe('form')
    expect(save?.depth).toBe(3)
    expect(diagram.flows).toHaveLength(1)
    expect(diagram.flows?.[0]).toMatchObject({ from: 'app', to: 'mobile', label: 'handoff' })
  })

  it('parses wireframe flow route turns with route= and turns= aliases', () => {
    const source = `wireframe
screen app:App 720x560
  card a:Alpha
  card b:Beta
flow a -> b route=left,down,right | primary
flow b -> a turns=up left`
    const diagram = parseDiagram(source)

    expect(diagram.flows).toHaveLength(2)
    expect(diagram.flows?.[0]).toMatchObject({
      from: 'a',
      to: 'b',
      label: 'primary',
      route: [
        { direction: 'left' },
        { direction: 'down' },
        { direction: 'right' },
      ],
    })
    expect(diagram.flows?.[1]).toMatchObject({
      from: 'b',
      to: 'a',
      route: [
        { direction: 'up' },
        { direction: 'left' },
      ],
    })
  })

  it('parses wireframe flow route lengths with repeats and explicit distances', () => {
    const source = `wireframe
screen app:App 720x560
  card a:Alpha
  card b:Beta
flow a -> b route=left*2,down:140,right`
    const diagram = parseDiagram(source)
    expect(diagram.flows?.[0]).toMatchObject({
      route: [
        { direction: 'left' },
        { direction: 'left' },
        { direction: 'down', distance: 140 },
        { direction: 'right' },
      ],
    })
  })

  it('parses sequence mode with wrap and implicit chained edges', () => {
    const source = `sequence wrap=4
style clean
start:Start
draft:Draft
review(Review)
approve{Approve?}
publish:Publish`
    const diagram = parseDiagram(source)

    expect(diagram.meta.kind).toBe('sequence')
    expect(diagram.meta.style).toBe('clean')
    expect(diagram.meta.sequenceWrap).toBe(4)
    expect(diagram.nodes.map(node => node.id)).toEqual(['start', 'draft', 'review', 'approve', 'publish'])
    expect(diagram.edges).toEqual([
      { from: 'start', to: 'draft', style: 'solid', arrow: 'arrow' },
      { from: 'draft', to: 'review', style: 'solid', arrow: 'arrow' },
      { from: 'review', to: 'approve', style: 'solid', arrow: 'arrow' },
      { from: 'approve', to: 'publish', style: 'solid', arrow: 'arrow' },
    ])
  })

  it('parses sequence mode from graph-style chain syntax', () => {
    const source = `sequence wrap=4 rowgap=90 colgap=44 snake=vertical
style architect
a(Start)->b:Build->c{Check}->d(Done)->e:Ship`
    const diagram = parseDiagram(source)

    expect(diagram.meta.kind).toBe('sequence')
    expect(diagram.meta.style).toBe('architect')
    expect(diagram.meta.sequenceWrap).toBe(4)
    expect(diagram.meta.sequenceRowGap).toBe(90)
    expect(diagram.meta.sequenceColumnGap).toBe(44)
    expect(diagram.meta.sequenceSnake).toBe('vertical')
    expect(diagram.nodes.map(node => node.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(diagram.edges).toEqual([
      { from: 'a', to: 'b', style: 'solid', arrow: 'arrow' },
      { from: 'b', to: 'c', style: 'solid', arrow: 'arrow' },
      { from: 'c', to: 'd', style: 'solid', arrow: 'arrow' },
      { from: 'd', to: 'e', style: 'solid', arrow: 'arrow' },
    ])
  })

  it('parses explicit sequence row breaks', () => {
    const source = `sequence wrap=4
a->b->c
break
d->e`
    const diagram = parseDiagram(source)

    expect(diagram.sequenceBreaks).toEqual([3])
    expect(diagram.nodes.map(node => node.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('parses sequence phase and lane markers into groups', () => {
    const source = `sequence wrap=4
phase setup:Setup
a->b->c
lane review:Review Lane
c->d->e`
    const diagram = parseDiagram(source)

    expect(diagram.groups).toEqual([
      { id: 'phase_setup', label: 'Setup', nodeIds: ['a', 'b', 'c'] },
      { id: 'lane_review', label: 'Review Lane', nodeIds: ['d', 'e'] },
    ])
  })

  it('parses sequence notes', () => {
    const source = `sequence wrap=4
a->b->c
note right of b:Wait for review
note over c:Deploy window`
    const diagram = parseDiagram(source)

    expect(diagram.notes).toEqual([
      { target: 'b', placement: 'right', label: 'Wait for review' },
      { target: 'c', placement: 'over', label: 'Deploy window' },
    ])
  })

  it('keeps edge labels on sequence chain transitions', () => {
    const source = `sequence wrap=4
a->b|draft->c|reviewed->d`
    const diagram = parseDiagram(source)

    expect(diagram.edges).toEqual([
      { from: 'a', to: 'b', label: 'draft', style: 'solid', arrow: 'arrow' },
      { from: 'b', to: 'c', label: 'reviewed', style: 'solid', arrow: 'arrow' },
      { from: 'c', to: 'd', style: 'solid', arrow: 'arrow' },
    ])
  })

  it('rejects sequence lines that are neither steps nor chains', () => {
    const source = `sequence wrap=3
foo bar baz`
    expect(() => parseDiagram(source)).toThrow(/Cannot parse node expression|could not parse line/i)
  })

  it('rejects dangling sequence breaks', () => {
    const source = `sequence wrap=3
a->b
break`
    expect(() => parseDiagram(source)).toThrow(/Sequence break must be followed by a step/)
  })
})
