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
const TITLE_GAP = 18

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
  if (!hasChildren && (kind === 'input' || kind === 'textarea' || kind === 'text' || kind === 'list')) return 16
  return kind === 'screen' ? 26 : 22
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
    case 'header':
      return { width: safeWidth, height: component.height ?? 84 }
    case 'button': {
      const natural = Math.max(116, Math.min(safeWidth, component.label.length * 12 + 56))
      return { width: component.width ?? natural, height: component.height ?? 50 }
    }
    case 'input':
      return { width: component.width ?? safeWidth, height: component.height ?? 58 }
    case 'textarea':
      return { width: component.width ?? safeWidth, height: component.height ?? 118 }
    case 'image':
      return { width: component.width ?? safeWidth, height: component.height ?? Math.max(150, Math.min(240, safeWidth * 0.55)) }
    case 'text':
      return { width: component.width ?? safeWidth, height: component.height ?? 82 }
    case 'list':
      return { width: component.width ?? safeWidth, height: component.height ?? 126 }
    case 'row': {
      if (children.length === 0) return { width: safeWidth, height: 120 }
      const childWidth = (safeWidth - ROW_GAP * Math.max(children.length - 1, 0)) / children.length
      const heights = children.map(child => measureComponent(child, childWidth, childMap).height)
      return { width: component.width ?? safeWidth, height: component.height ?? Math.max(...heights) }
    }
    case 'column':
    case 'panel':
    case 'card':
    case 'sidebar': {
      const innerWidth = Math.max(120, safeWidth - 24 * 2)
      const titleSpace = titleAllowance(component.kind, component, hasChildren)
      if (children.length === 0) {
        const base = component.kind === 'card' ? 144 : component.kind === 'panel' ? 170 : 120
        return { width: component.width ?? safeWidth, height: component.height ?? base }
      }
      const childHeights = children.map(child => measureComponent(child, innerWidth, childMap).height)
      const totalChildren = childHeights.reduce((sum, value) => sum + value, 0)
      const gapTotal = STACK_GAP * Math.max(children.length - 1, 0)
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
    const measured = children.map(child => ({
      child,
      size: measureComponent(child, Math.max(100, contentW / Math.max(children.length, 1)), childMap),
    }))
    const fixedWidth = measured.reduce((sum, item) => sum + item.size.width, 0) + ROW_GAP * Math.max(children.length - 1, 0)
    const flexExtra = Math.max(0, contentW - fixedWidth)
    let cursorX = contentX
    for (const item of measured) {
      const childWidth = item.child.kind === 'text' ? item.size.width + flexExtra / Math.max(1, children.length) : item.size.width
      layoutComponent(item.child, cursorX, contentY, childWidth, Math.min(contentH, item.size.height), childMap, output)
      cursorX += childWidth + ROW_GAP
    }
    return
  }

  if (component.kind === 'row') {
    const childWidth = (width - ROW_GAP * Math.max(children.length - 1, 0)) / Math.max(children.length, 1)
    let cursorX = x
    for (const child of children) {
      const size = measureComponent(child, childWidth, childMap)
      layoutComponent(child, cursorX, y, childWidth, Math.max(height, size.height), childMap, output)
      cursorX += childWidth + ROW_GAP
    }
    return
  }

  const pad = component.kind === 'sidebar' ? 18 : 24
  const titleSpace = titleAllowance(component.kind, component, true)
  const contentX = x + pad
  const contentY = y + pad + titleSpace
  const contentW = Math.max(120, width - pad * 2)
  let cursorY = contentY

  for (const child of children) {
    const size = measureComponent(child, contentW, childMap)
    layoutComponent(child, contentX, cursorY, contentW, size.height, childMap, output)
    cursorY += size.height + STACK_GAP
  }
}

function layoutWireframe(diagram: ScrawlDiagram, source: string): LayoutResult {
  const seed = computeSeed(source)
  const components = diagram.components ?? []
  const childMap = childrenMap(components)
  const screens = components.filter(component => component.kind === 'screen')
  const layoutComponents: LayoutComponent[] = []

  let cursorY = PADDING
  let maxWidth = 0
  for (const screen of screens) {
    const size = measureComponent(screen, screen.width ?? 1440, childMap)
    layoutComponent(screen, PADDING, cursorY, size.width, size.height, childMap, layoutComponents)
    maxWidth = Math.max(maxWidth, size.width + PADDING * 2)
    cursorY += size.height + SCREEN_GAP
  }

  return {
    meta: diagram.meta,
    nodes: [],
    edges: [],
    groups: [],
    components: layoutComponents,
    seed,
    width: maxWidth || 1024,
    height: Math.max(cursorY - SCREEN_GAP + PADDING, 720),
  }
}

export function layoutDiagram(diagram: ScrawlDiagram, source: string): LayoutResult {
  if (diagram.meta.kind === 'wireframe') return layoutWireframe(diagram, source)
  return layoutGraph(diagram, source)
}
