export type Direction = 'lr' | 'td' | 'rl' | 'dt' | 'radial'
export type Theme = 'rough' | 'clean'
export type StylePreset = 'sketch' | 'rough' | 'clean' | 'architect' | 'blueprint'
export type ShapeType = 'b' | 'r' | 'c' | 'd' | 'y' | 'p' | 'h'
export type EdgeStyle = 'solid' | 'dashed' | 'dotted'
export type ArrowType = 'arrow' | 'none' | 'both'
export type DiagramKind = 'graph' | 'wireframe' | 'sequence' | 'chart'
export type ChartKind =
  | 'bar'
  | 'line'
  | 'scatter'
  | 'area'
  | 'pie'
  | 'donut'
  | 'combo'
  | 'waterfall'
  | 'heatmap'
  | 'radar'
  | 'radial-bar'
  | 'treemap'
  | 'sunburst'
  | 'funnel'
  | 'sankey'
  | 'gauge'
  | 'likert'
  | 'box'
  | 'dot'
  | 'tornado'
export type ChartLegendPosition = 'right' | 'top' | 'bottom' | 'none'
export type ChartGridMode = 'none' | 'x' | 'y' | 'both'
export type ChartPointMode = 'show' | 'hide' | 'auto'
export type ChartStackMode = 'grouped' | 'stacked' | 'percent'
export type ChartCurveMode = 'linear' | 'smooth' | 'step'
export type ChartLabelMode = 'show' | 'hide' | 'auto'
export type ChartSeriesType = 'bar' | 'line' | 'area' | 'scatter'
export type ChartAxis = 'left' | 'right'
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
  color?: string
  axis?: ChartAxis
  type?: ChartSeriesType
  curve?: ChartCurveMode
  labels?: ChartLabelMode
}

export interface ChartReferenceLine {
  axis: 'x' | 'y' | 'y2'
  value: string | number
  label?: string
  color?: string
}

export interface ChartAnnotation {
  x: string | number
  y: number
  label: string
  color?: string
}

export interface ChartFlowLink {
  from: string
  to: string
  value: number
  color?: string
}

export interface ChartCell {
  row: string
  column: string
  value: number
  color?: string
}

export interface ChartHierarchyItem {
  path: string[]
  value: number
  color?: string
}

export interface ChartThreshold {
  upto: number
  color: string
  label?: string
}

export interface ScrawlChart {
  kind: ChartKind
  title?: string
  xLabel?: string
  yLabel?: string
  categories?: string[]
  legend?: ChartLegendPosition
  grid?: ChartGridMode
  points?: ChartPointMode
  stack?: ChartStackMode
  curve?: ChartCurveMode
  labels?: ChartLabelMode
  xTickCount?: number
  yTickCount?: number
  y2TickCount?: number
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  y2Min?: number
  y2Max?: number
  innerRadius?: number
  target?: number
  thresholds?: ChartThreshold[]
  references?: ChartReferenceLine[]
  annotations?: ChartAnnotation[]
  flows?: ChartFlowLink[]
  cells?: ChartCell[]
  items?: ChartHierarchyItem[]
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
  minY2?: number
  maxY2?: number
  xTicks: LayoutChartTick[]
  yTicks: LayoutChartTick[]
  y2Ticks?: LayoutChartTick[]
}

export interface LayoutChartTick {
  value: number
  label: string
}
