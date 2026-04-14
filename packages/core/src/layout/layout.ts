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

    if (fromScreen && toScreen && fromScreen.id !== toScreen.id) {
      const start: [number, number] = [fromScreen.x + fromScreen.width, from.y + from.height / 2]
      const end: [number, number] = [toScreen.x + toScreen.width, to.y + to.height / 2]
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

    const horizontalFrom: [number, number] = [from.x + from.width, from.y + from.height / 2]
    const horizontalTo: [number, number] = [to.x, to.y + to.height / 2]
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

    const verticalFrom: [number, number] = [from.x + from.width / 2, from.y + from.height]
    const verticalTo: [number, number] = [to.x + to.width / 2, to.y]
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
  })

  return {
    meta: diagram.meta,
    nodes: [],
    edges: [],
    groups: [],
    components: layoutComponents,
    flows,
    seed,
    width: maxWidth || 1024,
    height: Math.max(cursorY - SCREEN_GAP + PADDING, 720),
  }
}

export function layoutDiagram(diagram: ScrawlDiagram, source: string): LayoutResult {
  if (diagram.meta.kind === 'wireframe') return layoutWireframe(diagram, source)
  return layoutGraph(diagram, source)
}
