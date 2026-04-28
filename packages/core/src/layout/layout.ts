import dagre from '@dagrejs/dagre'
import type {
  ScrawlDiagram,
  LayoutResult,
  LayoutNode,
  LayoutEdge,
  LayoutGroup,
  ShapeType,
  ScrawlComponent,
  LayoutComponent,
  WireframeKind,
  LayoutWireframeFlow,
  RouteTurn,
  LayoutSequenceNote,
  LayoutChart,
} from '../ir/types.js'
import { computeSeed } from './seed.js'

const PADDING = 40
const NODE_W = 140
const NODE_H = 55
const CIRCLE_SIZE = 70

const SCREEN_PADDING = 28
const SCREEN_GAP = 48
const STACK_GAP = 18
const ROW_GAP = 18
const FLOW_TURN_STEP = 72

function nodeSize(shape: ShapeType): { width: number; height: number } {
  if (shape === 'c') return { width: CIRCLE_SIZE, height: CIRCLE_SIZE }
  if (shape === 'd') return { width: 100, height: 70 }
  if (shape === 'y') return { width: 120, height: 75 }
  return { width: NODE_W, height: NODE_H }
}

function dirToRankDir(dir: string): string {
  switch (dir) {
    case 'lr': return 'LR'
    case 'rl': return 'RL'
    case 'dt': return 'BT'
    default: return 'TB'
  }
}

function layoutGraph(diagram: ScrawlDiagram, source: string): LayoutResult {
  const seed = computeSeed(source)
  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: dirToRankDir(diagram.meta.dir),
    nodesep: 40,
    ranksep: 60,
    marginx: PADDING,
    marginy: PADDING,
  })

  for (const group of diagram.groups) {
    g.setNode(group.id, { label: group.label ?? '', clusterLabelPos: 'top' })
  }

  for (const node of diagram.nodes) {
    const { width, height } = nodeSize(node.shape)
    g.setNode(node.id, { label: node.label, width, height })
    if (node.groupId) g.setParent(node.id, node.groupId)
  }

  for (const edge of diagram.edges) {
    g.setEdge(edge.from, edge.to, { label: edge.label ?? '' })
  }

  dagre.layout(g)

  const layoutNodes: LayoutNode[] = diagram.nodes.map(node => {
    const gNode = g.node(node.id)
    return { ...node, x: gNode.x, y: gNode.y, width: gNode.width, height: gNode.height }
  })

  const layoutEdges: LayoutEdge[] = diagram.edges.map(edge => {
    const gEdge = g.edge(edge.from, edge.to)
    const points: Array<[number, number]> = (gEdge?.points ?? []).map(
      (p: { x: number; y: number }) => [p.x, p.y] as [number, number],
    )
    return { ...edge, points }
  })

  const layoutGroups: LayoutGroup[] = diagram.groups.map(group => {
    const gNode = g.node(group.id)
    return {
      ...group,
      x: gNode?.x ?? 0,
      y: gNode?.y ?? 0,
      width: gNode?.width ?? 100,
      height: gNode?.height ?? 60,
    }
  })

  let maxX = 0
  let maxY = 0
  for (const n of layoutNodes) {
    maxX = Math.max(maxX, n.x + n.width / 2 + PADDING)
    maxY = Math.max(maxY, n.y + n.height / 2 + PADDING)
  }

  return {
    meta: diagram.meta,
    nodes: layoutNodes,
    edges: layoutEdges,
    groups: layoutGroups,
    seed,
    width: maxX,
    height: maxY,
  }
}

function layoutSequence(diagram: ScrawlDiagram, source: string): LayoutResult {
  const seed = computeSeed(source)
  const wrapSetting = diagram.meta.sequenceWrap ?? diagram.nodes.length
  const wrap = Math.max(1, wrapSetting || 1)
  const breakSet = new Set(diagram.sequenceBreaks ?? [])
  const snake = diagram.meta.sequenceSnake ?? 'horizontal'
  const maxNodeWidth = Math.max(...diagram.nodes.map(node => nodeSize(node.shape).width), NODE_W)
  const maxNodeHeight = Math.max(...diagram.nodes.map(node => nodeSize(node.shape).height), NODE_H)
  const columnGap = diagram.meta.sequenceColumnGap ?? 56
  const rowGap = diagram.meta.sequenceRowGap ?? 70
  const slotWidth = maxNodeWidth + columnGap
  const slotHeight = maxNodeHeight + rowGap
  const buckets: typeof diagram.nodes[] = []
  let currentBucket: typeof diagram.nodes = []
  for (let index = 0; index < diagram.nodes.length; index++) {
    if (index > 0 && (breakSet.has(index) || currentBucket.length >= wrap)) {
      buckets.push(currentBucket)
      currentBucket = []
    }
    currentBucket.push(diagram.nodes[index]!)
  }
  if (currentBucket.length > 0) buckets.push(currentBucket)

  const layoutNodes: LayoutNode[] = []
  for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex++) {
    const bucket = buckets[bucketIndex]!
    for (let itemIndex = 0; itemIndex < bucket.length; itemIndex++) {
      const node = bucket[itemIndex]!
      const visualIndex = bucketIndex % 2 === 0 ? itemIndex : bucket.length - 1 - itemIndex
      const x = snake === 'horizontal'
        ? PADDING + visualIndex * slotWidth + maxNodeWidth / 2
        : PADDING + bucketIndex * slotWidth + maxNodeWidth / 2
      const y = snake === 'horizontal'
        ? PADDING + bucketIndex * slotHeight + maxNodeHeight / 2
        : PADDING + visualIndex * slotHeight + maxNodeHeight / 2

      const size = nodeSize(node.shape)
      layoutNodes.push({
        ...node,
        x,
        y,
        width: size.width,
        height: size.height,
      })
    }
  }

  const nodeLookup = new Map(layoutNodes.map(node => [node.id, node]))
  const outgoingCounts = new Map<string, number>()
  const incomingCounts = new Map<string, number>()
  for (const edge of diagram.edges) {
    outgoingCounts.set(edge.from, (outgoingCounts.get(edge.from) ?? 0) + 1)
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1)
  }

  const outgoingIndex = new Map<string, number>()
  const incomingIndex = new Map<string, number>()
  const portOffset = (index: number, count: number, size: number) => {
    if (count <= 1) return 0
    const usable = Math.min(size * 0.6, 18 * Math.max(count - 1, 1))
    const step = usable / Math.max(count - 1, 1)
    return -usable / 2 + step * index
  }

  const layoutEdges: LayoutEdge[] = diagram.edges.map(edge => {
    const from = nodeLookup.get(edge.from)
    const to = nodeLookup.get(edge.to)
    if (!from || !to) return { ...edge, points: [] }

    const outCount = outgoingCounts.get(edge.from) ?? 1
    const inCount = incomingCounts.get(edge.to) ?? 1
    const outIndex = outgoingIndex.get(edge.from) ?? 0
    const inIndex = incomingIndex.get(edge.to) ?? 0
    outgoingIndex.set(edge.from, outIndex + 1)
    incomingIndex.set(edge.to, inIndex + 1)

    if (from.y === to.y) {
      const goingRight = to.x > from.x
      const start: [number, number] = [
        from.x + (goingRight ? from.width / 2 : -from.width / 2),
        from.y + portOffset(outIndex, outCount, from.height),
      ]
      const end: [number, number] = [
        to.x + (goingRight ? -to.width / 2 : to.width / 2),
        to.y + portOffset(inIndex, inCount, to.height),
      ]
      const midX = (start[0] + end[0]) / 2
      return {
        ...edge,
        points: [start, [midX, start[1]], [midX, end[1]], end],
      }
    }

    if (snake === 'horizontal') {
      const startY = to.y > from.y ? from.y + from.height / 2 : from.y - from.height / 2
      const endY = to.y > from.y ? to.y - to.height / 2 : to.y + to.height / 2
      const startX = from.x + portOffset(outIndex, outCount, from.width)
      const endX = to.x + portOffset(inIndex, inCount, to.width)
      const midY = (startY + endY) / 2
      return {
        ...edge,
        points: [
          [startX, startY],
          [startX, midY],
          [endX, midY],
          [endX, endY],
        ],
      }
    }

    const startX = to.x > from.x ? from.x + from.width / 2 : from.x - from.width / 2
    const endX = to.x > from.x ? to.x - to.width / 2 : to.x + to.width / 2
    const startY = from.y + portOffset(outIndex, outCount, from.height)
    const endY = to.y + portOffset(inIndex, inCount, to.height)
    const midX = (startX + endX) / 2
    return {
      ...edge,
      points: [
        [startX, startY],
        [midX, startY],
        [midX, endY],
        [endX, endY],
      ],
    }
  })

  const layoutNotes: LayoutSequenceNote[] = (diagram.notes ?? []).flatMap(note => {
    const target = nodeLookup.get(note.target)
    if (!target) return []

    const lines = note.label.split('\n')
    const longest = Math.max(...lines.map(line => line.length), 0)
    const width = Math.max(140, longest * 8 + 28)
    const height = Math.max(54, lines.length * 18 + 20)
    const gap = 22

    let x = target.x
    let y = target.y
    let leaderPoints: Array<[number, number]> | undefined
    if (note.placement === 'left') {
      x = target.x - target.width / 2 - gap - width / 2
      const targetAnchor: [number, number] = [target.x - target.width / 2, target.y]
      const noteAnchor: [number, number] = [x + width / 2, y]
      const midX = (targetAnchor[0] + noteAnchor[0]) / 2
      leaderPoints = [targetAnchor, [midX, targetAnchor[1]], [midX, noteAnchor[1]], noteAnchor]
    } else if (note.placement === 'right') {
      x = target.x + target.width / 2 + gap + width / 2
      const targetAnchor: [number, number] = [target.x + target.width / 2, target.y]
      const noteAnchor: [number, number] = [x - width / 2, y]
      const midX = (targetAnchor[0] + noteAnchor[0]) / 2
      leaderPoints = [targetAnchor, [midX, targetAnchor[1]], [midX, noteAnchor[1]], noteAnchor]
    } else {
      y = target.y - target.height / 2 - gap - height / 2
      const targetAnchor: [number, number] = [target.x, target.y - target.height / 2]
      const noteAnchor: [number, number] = [x, y + height / 2]
      const midY = (targetAnchor[1] + noteAnchor[1]) / 2
      leaderPoints = [targetAnchor, [targetAnchor[0], midY], [noteAnchor[0], midY], noteAnchor]
    }

    return [{ ...note, x, y, width, height, leaderPoints }]
  })

  const layoutGroups: LayoutGroup[] = (diagram.groups ?? []).flatMap(group => {
    const groupNodes = group.nodeIds
      .map(id => nodeLookup.get(id))
      .filter((node): node is LayoutNode => Boolean(node))
    if (groupNodes.length === 0) return []

    const padX = 28
    const padYTop = 18 + Math.max((group.label?.split('\n').length ?? 1) * 16, 16)
    const padYBottom = 24
    const minX = Math.min(...groupNodes.map(node => node.x - node.width / 2))
    const maxX = Math.max(...groupNodes.map(node => node.x + node.width / 2))
    const minY = Math.min(...groupNodes.map(node => node.y - node.height / 2))
    const maxY = Math.max(...groupNodes.map(node => node.y + node.height / 2))

    return [{
      ...group,
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2 + (padYBottom - padYTop) / 2,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padYTop + padYBottom,
    }]
  })
  const minX = Math.min(
    ...layoutNodes.map(node => node.x - node.width / 2),
    ...layoutGroups.map(group => group.x - group.width / 2),
    ...layoutNotes.map(note => note.x - note.width / 2),
    PADDING,
  )
  const minY = Math.min(
    ...layoutNodes.map(node => node.y - node.height / 2),
    ...layoutGroups.map(group => group.y - group.height / 2),
    ...layoutNotes.map(note => note.y - note.height / 2),
    PADDING,
  )
  const shiftX = minX < PADDING ? PADDING - minX : 0
  const shiftY = minY < PADDING ? PADDING - minY : 0

  if (shiftX !== 0 || shiftY !== 0) {
    for (const node of layoutNodes) {
      node.x += shiftX
      node.y += shiftY
    }
    for (const edge of layoutEdges) {
      edge.points = edge.points.map(([x, y]) => [x + shiftX, y + shiftY])
    }
    for (const group of layoutGroups) {
      group.x += shiftX
      group.y += shiftY
    }
    for (const note of layoutNotes) {
      note.x += shiftX
      note.y += shiftY
    }
  }

  const maxX = Math.max(
    ...layoutNodes.map(node => node.x + node.width / 2),
    ...layoutGroups.map(group => group.x + group.width / 2),
    ...layoutNotes.map(note => note.x + note.width / 2),
    0,
  ) + PADDING
  const maxY = Math.max(
    ...layoutNodes.map(node => node.y + node.height / 2),
    ...layoutGroups.map(group => group.y + group.height / 2),
    ...layoutNotes.map(note => note.y + note.height / 2),
    0,
  ) + PADDING

  return {
    meta: diagram.meta,
    nodes: layoutNodes,
    edges: layoutEdges,
    groups: layoutGroups,
    notes: layoutNotes,
    seed,
    width: maxX,
    height: maxY,
  }
}

function normalizeAxisRange(min: number, max: number, padFraction = 0): { min: number; max: number } {
  if (min === max) {
    const delta = Math.max(1, Math.abs(min) * 0.1)
    return { min: min - delta, max: max + delta }
  }

  const span = max - min
  const pad = span * padFraction
  return { min: min - pad, max: max + pad }
}

function layoutChart(diagram: ScrawlDiagram, source: string): LayoutResult {
  const seed = computeSeed(source)
  const sourceChart = diagram.chart
  if (!sourceChart) {
    throw new Error('Chart mode requires chart data')
  }

  const width = 960
  const height = 620
  const plotX = 104
  const plotY = 92
  const plotWidth = 760
  const plotHeight = 420

  let minX = 0
  let maxX = 1
  let minY = 0
  let maxY = 1

  if (sourceChart.kind === 'scatter') {
    const points = sourceChart.series.flatMap(series => series.points ?? [])
    const xValues = points.map(point => point[0])
    const yValues = points.map(point => point[1])
    const xRange = normalizeAxisRange(Math.min(...xValues), Math.max(...xValues), 0.08)
    const yRange = normalizeAxisRange(Math.min(...yValues), Math.max(...yValues), 0.08)
    minX = xRange.min
    maxX = xRange.max
    minY = yRange.min
    maxY = yRange.max
  } else {
    const values = sourceChart.series.flatMap(series => series.values ?? [])
    const yRange = normalizeAxisRange(Math.min(0, ...values), Math.max(0, ...values))
    minX = 0
    maxX = Math.max((sourceChart.categories?.length ?? values.length) - 1, 1)
    minY = yRange.min
    maxY = yRange.max
  }

  const chart: LayoutChart = {
    ...sourceChart,
    plotX,
    plotY,
    plotWidth,
    plotHeight,
    minX,
    maxX,
    minY,
    maxY,
  }

  return {
    meta: diagram.meta,
    nodes: [],
    edges: [],
    groups: [],
    chart,
    seed,
    width,
    height,
  }
}

function childrenMap(components: ScrawlComponent[]): Map<string, ScrawlComponent[]> {
  const map = new Map<string, ScrawlComponent[]>()
  for (const component of components) {
    if (!component.parentId) continue
    const list = map.get(component.parentId) ?? []
    list.push(component)
    map.set(component.parentId, list)
  }
  return map
}

function titleAllowance(kind: WireframeKind, component: ScrawlComponent, hasChildren: boolean): number {
  if (!component.label) return 0
  if (kind === 'button') return 0
  if (!hasChildren && (
    kind === 'input' ||
    kind === 'textarea' ||
    kind === 'text' ||
    kind === 'list' ||
    kind === 'select' ||
    kind === 'checkbox' ||
    kind === 'radio' ||
    kind === 'badge'
  )) return 16
  return kind === 'screen' ? 26 : 22
}

function componentGap(component: ScrawlComponent): number {
  return component.gap ?? (component.kind === 'header' || component.kind === 'row' ? ROW_GAP : STACK_GAP)
}

function clampWidth(width: number | undefined, fallback: number): number {
  return width && Number.isFinite(width) && width > 0 ? width : fallback
}

type Point = [number, number]

function oppositeDirection(direction: RouteTurn): RouteTurn {
  switch (direction) {
    case 'up': return 'down'
    case 'down': return 'up'
    case 'left': return 'right'
    case 'right': return 'left'
  }
}

function pointForDirection(component: LayoutComponent, direction: RouteTurn): Point {
  switch (direction) {
    case 'up':
      return [component.x + component.width / 2, component.y]
    case 'down':
      return [component.x + component.width / 2, component.y + component.height]
    case 'left':
      return [component.x, component.y + component.height / 2]
    case 'right':
      return [component.x + component.width, component.y + component.height / 2]
  }
}

function advancePoint([x, y]: Point, direction: RouteTurn, distance: number): Point {
  switch (direction) {
    case 'up':
      return [x, y - distance]
    case 'down':
      return [x, y + distance]
    case 'left':
      return [x - distance, y]
    case 'right':
      return [x + distance, y]
  }
}

function pushPoint(points: Point[], point: Point) {
  const last = points[points.length - 1]
  if (last && last[0] === point[0] && last[1] === point[1]) return
  points.push(point)
}

function routeFlowWithTurns(
  flow: LayoutWireframeFlow,
  from: LayoutComponent,
  to: LayoutComponent,
): LayoutWireframeFlow {
  const route = flow.route ?? []
  if (route.length === 0) return flow

  const startDirection = route[0]!.direction
  const endDirection = route[route.length - 1]!.direction
  const start = pointForDirection(from, startDirection)
  const end = pointForDirection(to, oppositeDirection(endDirection))
  const points: Point[] = [start]

  let cursor = start
  for (const step of route) {
    cursor = advancePoint(cursor, step.direction, step.distance ?? FLOW_TURN_STEP)
    pushPoint(points, cursor)
  }

  if (endDirection === 'left' || endDirection === 'right') {
    pushPoint(points, [end[0], cursor[1]])
  } else {
    pushPoint(points, [cursor[0], end[1]])
  }
  pushPoint(points, end)

  return { ...flow, points }
}

function autoRouteFlow(
  flow: LayoutWireframeFlow,
  from: LayoutComponent,
  to: LayoutComponent,
  fromScreen: LayoutComponent | undefined,
  toScreen: LayoutComponent | undefined,
  routeGutter: number,
): LayoutWireframeFlow[] {
  if (fromScreen && toScreen && fromScreen.id !== toScreen.id) {
    const start: Point = [fromScreen.x + fromScreen.width, from.y + from.height / 2]
    const end: Point = [toScreen.x + toScreen.width, to.y + to.height / 2]
    return [{
      ...flow,
      points: [
        start,
        [routeGutter, start[1]],
        [routeGutter, end[1]],
        end,
      ],
    }]
  }

  const horizontalFrom: Point = [from.x + from.width, from.y + from.height / 2]
  const horizontalTo: Point = [to.x, to.y + to.height / 2]
  if (Math.abs(horizontalFrom[0] - horizontalTo[0]) > Math.abs(horizontalFrom[1] - horizontalTo[1])) {
    const midX = (horizontalFrom[0] + horizontalTo[0]) / 2
    return [{
      ...flow,
      points: [
        horizontalFrom,
        [midX, horizontalFrom[1]],
        [midX, horizontalTo[1]],
        horizontalTo,
      ],
    }]
  }

  const verticalFrom: Point = [from.x + from.width / 2, from.y + from.height]
  const verticalTo: Point = [to.x + to.width / 2, to.y]
  const midY = (verticalFrom[1] + verticalTo[1]) / 2
  return [{
    ...flow,
    points: [
      verticalFrom,
      [verticalFrom[0], midY],
      [verticalTo[0], midY],
      verticalTo,
    ],
  }]
}

function horizontalLayout(
  component: ScrawlComponent,
  children: ScrawlComponent[],
  availableWidth: number,
  childMap: Map<string, ScrawlComponent[]>,
) {
  const gap = componentGap(component)
  const fixed = children.map(child => ({ child, explicit: child.width }))
  const totalExplicit = fixed.reduce((sum, item) => sum + (item.explicit ?? 0), 0)
  const flexChildren = fixed.filter(item => !item.explicit)
  const totalGap = gap * Math.max(children.length - 1, 0)
  const remaining = Math.max(120, availableWidth - totalExplicit - totalGap)
  const totalSpan = flexChildren.reduce((sum, item) => sum + (item.child.span ?? 1), 0) || 1

  return children.map(child => {
    const width = child.width ?? (remaining * (child.span ?? 1) / totalSpan)
    const size = measureComponent(child, width, childMap)
    return { child, width, height: size.height }
  })
}

function measureComponent(
  component: ScrawlComponent,
  availableWidth: number,
  childMap: Map<string, ScrawlComponent[]>,
): { width: number; height: number } {
  const children = childMap.get(component.id) ?? []
  const hasChildren = children.length > 0
  const safeWidth = Math.max(availableWidth, 120)

  switch (component.kind) {
    case 'screen':
      return { width: component.width ?? 1440, height: component.height ?? 900 }
    case 'header': {
      const measurements = horizontalLayout(component, children, safeWidth, childMap)
      const heights = measurements.map(item => item.height)
      return { width: component.width ?? safeWidth, height: component.height ?? Math.max(84, ...heights.map(h => h + 24)) }
    }
    case 'button': {
      const natural = Math.max(116, Math.min(safeWidth, component.label.length * 12 + 56))
      return { width: component.width ?? natural, height: component.height ?? 50 }
    }
    case 'input':
      return { width: component.width ?? safeWidth, height: component.height ?? 58 }
    case 'select':
      return { width: component.width ?? safeWidth, height: component.height ?? 58 }
    case 'textarea':
      return { width: component.width ?? safeWidth, height: component.height ?? 118 }
    case 'image':
      return { width: component.width ?? safeWidth, height: component.height ?? Math.max(150, Math.min(240, safeWidth * 0.55)) }
    case 'text':
      return { width: component.width ?? safeWidth, height: component.height ?? 82 }
    case 'list':
      return { width: component.width ?? safeWidth, height: component.height ?? 126 }
    case 'checkbox':
    case 'radio':
      return { width: component.width ?? safeWidth, height: component.height ?? 34 }
    case 'avatar':
      return { width: component.width ?? 84, height: component.height ?? 84 }
    case 'badge':
      return { width: component.width ?? Math.max(88, component.label.length * 10 + 28), height: component.height ?? 32 }
    case 'toast':
      return { width: component.width ?? Math.min(safeWidth, 280), height: component.height ?? 76 }
    case 'tabs':
      return { width: component.width ?? safeWidth, height: component.height ?? 64 }
    case 'chart':
      return { width: component.width ?? safeWidth, height: component.height ?? 180 }
    case 'table':
      return { width: component.width ?? safeWidth, height: component.height ?? 190 }
    case 'modal':
      return { width: component.width ?? Math.min(safeWidth, 520), height: component.height ?? 280 }
    case 'row': {
      if (children.length === 0) return { width: safeWidth, height: 120 }
      const measurements = horizontalLayout(component, children, safeWidth, childMap)
      const heights = measurements.map(item => item.height)
      return { width: component.width ?? safeWidth, height: component.height ?? Math.max(...heights) }
    }
    case 'column':
    case 'panel':
    case 'card':
    case 'sidebar': {
      const innerWidth = Math.max(120, safeWidth - 24 * 2)
      const titleSpace = titleAllowance(component.kind, component, hasChildren)
      if (children.length === 0) {
        const base = component.kind === 'card' ? 144 : component.kind === 'panel' ? 170 : component.kind === 'sidebar' ? 200 : 120
        return { width: component.width ?? safeWidth, height: component.height ?? base }
      }
      const childHeights = children.map(child => measureComponent(child, clampWidth(child.width, innerWidth), childMap).height)
      const totalChildren = childHeights.reduce((sum, value) => sum + value, 0)
      const gapTotal = componentGap(component) * Math.max(children.length - 1, 0)
      return {
        width: component.width ?? safeWidth,
        height: component.height ?? titleSpace + totalChildren + gapTotal + 24 * 2,
      }
    }
  }
}

function layoutComponent(
  component: ScrawlComponent,
  x: number,
  y: number,
  width: number,
  height: number,
  childMap: Map<string, ScrawlComponent[]>,
  output: LayoutComponent[],
) {
  const children = childMap.get(component.id) ?? []
  output.push({ ...component, x, y, width, height })

  if (children.length === 0) return

  if (component.kind === 'screen') {
    const innerX = x + SCREEN_PADDING
    const innerY = y + SCREEN_PADDING
    const innerW = width - SCREEN_PADDING * 2
    const innerH = height - SCREEN_PADDING * 2

    const header = children.find(child => child.kind === 'header')
    const sidebar = children.find(child => child.kind === 'sidebar')
    const contentChildren = children.filter(child => child.id !== header?.id && child.id !== sidebar?.id)

    let topY = innerY
    let contentX = innerX
    let contentW = innerW
    let contentH = innerH

    if (header) {
      const headerHeight = measureComponent(header, innerW, childMap).height
      layoutComponent(header, innerX, topY, innerW, headerHeight, childMap, output)
      topY += headerHeight + STACK_GAP
      contentH -= headerHeight + STACK_GAP
    }

    if (sidebar) {
      const sidebarWidth = measureComponent(sidebar, Math.min(260, innerW * 0.28), childMap).width
      layoutComponent(sidebar, innerX, topY, sidebarWidth, contentH, childMap, output)
      contentX += sidebarWidth + STACK_GAP
      contentW -= sidebarWidth + STACK_GAP
    }

    let cursorY = topY
    for (const child of contentChildren) {
      const size = measureComponent(child, contentW, childMap)
      layoutComponent(child, contentX, cursorY, contentW, size.height, childMap, output)
      cursorY += size.height + STACK_GAP
    }
    return
  }

  if (component.kind === 'header') {
    const pad = 16
    const contentX = x + pad
    const contentY = y + 16
    const contentW = width - pad * 2
    const contentH = height - 32
    const measured = horizontalLayout(component, children, contentW, childMap)
    const baseGap = componentGap(component)
    const totalWidth = measured.reduce((sum, item) => sum + item.width, 0) + baseGap * Math.max(measured.length - 1, 0)
    let cursorX = contentX
    let gap = baseGap
    const align = component.align ?? 'start'
    if (align === 'center') cursorX += Math.max(0, (contentW - totalWidth) / 2)
    if (align === 'end') cursorX += Math.max(0, contentW - totalWidth)
    if (align === 'between' && measured.length > 1 && contentW > totalWidth) {
      gap = baseGap + (contentW - totalWidth) / (measured.length - 1)
    }
    for (const item of measured) {
      layoutComponent(item.child, cursorX, contentY, item.width, Math.min(contentH, item.height), childMap, output)
      cursorX += item.width + gap
    }
    return
  }

  if (component.kind === 'row') {
    const measured = horizontalLayout(component, children, width, childMap)
    const baseGap = componentGap(component)
    const totalWidth = measured.reduce((sum, item) => sum + item.width, 0) + baseGap * Math.max(measured.length - 1, 0)
    let cursorX = x
    let gap = baseGap
    const align = component.align ?? 'start'
    if (align === 'center') cursorX += Math.max(0, (width - totalWidth) / 2)
    if (align === 'end') cursorX += Math.max(0, width - totalWidth)
    if (align === 'between' && measured.length > 1 && width > totalWidth) {
      gap = baseGap + (width - totalWidth) / (measured.length - 1)
    }
    for (const item of measured) {
      layoutComponent(item.child, cursorX, y, item.width, Math.max(height, item.height), childMap, output)
      cursorX += item.width + gap
    }
    return
  }

  const pad = component.kind === 'sidebar' ? 18 : 24
  const titleSpace = titleAllowance(component.kind, component, true)
  const contentX = x + pad
  const contentY = y + pad + titleSpace
  const contentW = Math.max(120, width - pad * 2)
  let cursorY = contentY
  const align = component.align ?? 'start'
  const gap = componentGap(component)

  for (const child of children) {
    const childWidth = clampWidth(child.width, contentW)
    const size = measureComponent(child, childWidth, childMap)
    let childX = contentX
    if (align === 'center') childX += Math.max(0, (contentW - childWidth) / 2)
    if (align === 'end') childX += Math.max(0, contentW - childWidth)
    layoutComponent(child, childX, cursorY, childWidth, size.height, childMap, output)
    cursorY += size.height + gap
  }
}

function layoutWireframe(diagram: ScrawlDiagram, source: string): LayoutResult {
  const seed = computeSeed(source)
  const components = diagram.components ?? []
  const childMap = childrenMap(components)
  const screens = components.filter(component => component.kind === 'screen')
  const layoutComponents: LayoutComponent[] = []
  const screenLookup = new Map<string, LayoutComponent>()

  let cursorY = PADDING
  let maxWidth = 0
  for (const screen of screens) {
    const size = measureComponent(screen, screen.width ?? 1440, childMap)
    layoutComponent(screen, PADDING, cursorY, size.width, size.height, childMap, layoutComponents)
    const laidOutScreen = layoutComponents.find(component => component.id === screen.id)
    if (laidOutScreen) screenLookup.set(screen.id, laidOutScreen)
    maxWidth = Math.max(maxWidth, size.width + PADDING * 2)
    cursorY += size.height + SCREEN_GAP
  }

  const componentLookup = new Map(layoutComponents.map(component => [component.id, component]))
  const screenOf = new Map<string, LayoutComponent>()
  for (const component of layoutComponents) {
    if (component.kind === 'screen') {
      screenOf.set(component.id, component)
      continue
    }
    let cursor = component
    while (cursor.parentId) {
      const parent = componentLookup.get(cursor.parentId)
      if (!parent) break
      if (parent.kind === 'screen') {
        screenOf.set(component.id, parent)
        break
      }
      cursor = parent
    }
  }
  const globalRight = Math.max(...layoutComponents.filter(c => c.kind === 'screen').map(c => c.x + c.width), 0)
  const routeGutter = globalRight + 48
  const flows: LayoutWireframeFlow[] = (diagram.flows ?? []).flatMap(flow => {
    const from = componentLookup.get(flow.from)
    const to = componentLookup.get(flow.to)
    if (!from || !to) return []
    const fromScreen = screenOf.get(flow.from)
    const toScreen = screenOf.get(flow.to)

    if (flow.route?.length) {
      return [routeFlowWithTurns({ ...flow, points: [] }, from, to)]
    }

    return autoRouteFlow({ ...flow, points: [] }, from, to, fromScreen, toScreen, routeGutter)
  })

  const componentMinX = Math.min(...layoutComponents.map(component => component.x), PADDING)
  const componentMinY = Math.min(...layoutComponents.map(component => component.y), PADDING)
  const componentMaxX = Math.max(...layoutComponents.map(component => component.x + component.width), 0)
  const componentMaxY = Math.max(...layoutComponents.map(component => component.y + component.height), 0)
  const flowMinX = Math.min(...flows.flatMap(flow => flow.points.map(point => point[0])), componentMinX)
  const flowMinY = Math.min(...flows.flatMap(flow => flow.points.map(point => point[1])), componentMinY)
  const flowMaxX = Math.max(...flows.flatMap(flow => flow.points.map(point => point[0])), componentMaxX)
  const flowMaxY = Math.max(...flows.flatMap(flow => flow.points.map(point => point[1])), componentMaxY)

  const shiftX = flowMinX < PADDING ? PADDING - flowMinX : 0
  const shiftY = flowMinY < PADDING ? PADDING - flowMinY : 0

  if (shiftX !== 0 || shiftY !== 0) {
    for (const component of layoutComponents) {
      component.x += shiftX
      component.y += shiftY
    }
    for (const flow of flows) {
      flow.points = flow.points.map(([x, y]) => [x + shiftX, y + shiftY])
    }
  }

  const width = Math.max(
    ...layoutComponents.map(component => component.x + component.width),
    ...flows.flatMap(flow => flow.points.map(point => point[0])),
    maxWidth || 1024,
  ) + PADDING
  const height = Math.max(
    ...layoutComponents.map(component => component.y + component.height),
    ...flows.flatMap(flow => flow.points.map(point => point[1])),
    cursorY - SCREEN_GAP + PADDING,
    720,
  ) + PADDING

  return {
    meta: diagram.meta,
    nodes: [],
    edges: [],
    groups: [],
    components: layoutComponents,
    flows,
    seed,
    width,
    height,
  }
}

export function layoutDiagram(diagram: ScrawlDiagram, source: string): LayoutResult {
  if (diagram.meta.kind === 'wireframe') return layoutWireframe(diagram, source)
  if (diagram.meta.kind === 'sequence') return layoutSequence(diagram, source)
  if (diagram.meta.kind === 'chart') return layoutChart(diagram, source)
  return layoutGraph(diagram, source)
}
