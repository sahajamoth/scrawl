export type Direction = 'lr' | 'td' | 'rl' | 'dt' | 'radial'
export type Theme = 'rough' | 'clean'
export type StylePreset = 'sketch' | 'rough' | 'clean' | 'architect' | 'blueprint'
export type ShapeType = 'b' | 'r' | 'c' | 'd' | 'y' | 'p' | 'h'
export type EdgeStyle = 'solid' | 'dashed' | 'dotted'
export type ArrowType = 'arrow' | 'none' | 'both'
export type DiagramKind = 'graph' | 'wireframe' | 'sequence' | 'chart'
export type ChartKind = 'bar' | 'line' | 'scatter'
export type RouteTurn = 'up' | 'down' | 'left' | 'right'
export type WireframeKind =
  | 'screen'
  | 'header'
  | 'sidebar'
  | 'row'
  | 'column'
  | 'panel'
  | 'card'
  | 'button'
  | 'input'
  | 'textarea'
  | 'image'
  | 'text'
  | 'list'
  | 'tabs'
  | 'table'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'avatar'
  | 'badge'
  | 'modal'
  | 'toast'
  | 'chart'
export type WireframeAlign = 'start' | 'center' | 'end' | 'between'

export interface WireframeRouteStep {
  direction: RouteTurn
  distance?: number
}

export type SequenceNotePlacement = 'left' | 'right' | 'over'

export interface DiagramMeta {
  title?: string
  dir: Direction
  theme: Theme
  style?: StylePreset
  kind?: DiagramKind
  sequenceWrap?: number
  sequenceRowGap?: number
  sequenceColumnGap?: number
  sequenceSnake?: 'horizontal' | 'vertical'
}

export interface ChartSeries {
  name: string
  values?: number[]
  points?: Array<[number, number]>
}

export interface ScrawlChart {
  kind: ChartKind
  title?: string
  xLabel?: string
  yLabel?: string
  categories?: string[]
  series: ChartSeries[]
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
  chart?: ScrawlChart
  notes?: SequenceNote[]
  components?: ScrawlComponent[]
  flows?: WireframeFlow[]
  sequenceBreaks?: number[]
}

export interface ScrawlComponent {
  id: string
  kind: WireframeKind
  label: string
  parentId?: string
  width?: number
  height?: number
  span?: number
  align?: WireframeAlign
  gap?: number
  variant?: string
  depth: number
}

export interface WireframeFlow {
  from: string
  to: string
  label?: string
  route?: WireframeRouteStep[]
}

export interface SequenceNote {
  target: string
  placement: SequenceNotePlacement
  label: string
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
  chart?: LayoutChart
  notes?: LayoutSequenceNote[]
  components?: LayoutComponent[]
  flows?: LayoutWireframeFlow[]
  seed: number
  width: number
  height: number
}

export interface LayoutComponent extends ScrawlComponent {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutWireframeFlow extends WireframeFlow {
  points: Array<[number, number]>
}

export interface LayoutSequenceNote extends SequenceNote {
  x: number
  y: number
  width: number
  height: number
  leaderPoints?: Array<[number, number]>
}

export interface LayoutChart extends ScrawlChart {
  plotX: number
  plotY: number
  plotWidth: number
  plotHeight: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}
