export type Direction = 'lr' | 'td' | 'rl' | 'dt' | 'radial'
export type Theme = 'rough' | 'clean'
export type ShapeType = 'b' | 'r' | 'c' | 'd' | 'y' | 'p' | 'h'
export type EdgeStyle = 'solid' | 'dashed' | 'dotted'
export type ArrowType = 'arrow' | 'none' | 'both'

export interface DiagramMeta {
  title?: string
  dir: Direction
  theme: Theme
}

export interface ScrawlNode {
  id: string
  label: string
  shape: ShapeType
  color?: string
  groupId?: string
}

export interface ScrawlEdge {
  from: string
  to: string
  label?: string
  style: EdgeStyle
  arrow: ArrowType
}

export interface ScrawlGroup {
  id: string
  label?: string
  nodeIds: string[]
}

export interface ScrawlDiagram {
  meta: DiagramMeta
  nodes: ScrawlNode[]
  edges: ScrawlEdge[]
  groups: ScrawlGroup[]
}

export interface LayoutNode extends ScrawlNode {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutEdge extends ScrawlEdge {
  points: Array<[number, number]>
}

export interface LayoutGroup extends ScrawlGroup {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  meta: DiagramMeta
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  groups: LayoutGroup[]
  seed: number
  width: number
  height: number
}
