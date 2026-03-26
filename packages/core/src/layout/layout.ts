import dagre from '@dagrejs/dagre'
import type { ScrawlDiagram, LayoutResult, LayoutNode, LayoutEdge, LayoutGroup, ShapeType } from '../ir/types.js'
import { computeSeed } from './seed.js'

const PADDING = 40
const NODE_W = 140
const NODE_H = 55
const CIRCLE_SIZE = 70

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
    default: return 'TB' // td and radial fall back to TB
  }
}

export function layoutDiagram(diagram: ScrawlDiagram, source: string): LayoutResult {
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

  // Add group nodes (compound)
  for (const group of diagram.groups) {
    g.setNode(group.id, { label: group.label ?? '', clusterLabelPos: 'top' })
  }

  // Add nodes
  for (const node of diagram.nodes) {
    const { width, height } = nodeSize(node.shape)
    g.setNode(node.id, { label: node.label, width, height })
    if (node.groupId) g.setParent(node.id, node.groupId)
  }

  // Add edges
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

  // Compute canvas bounds
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
