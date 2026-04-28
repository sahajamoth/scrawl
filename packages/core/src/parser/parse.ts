import type {
  ScrawlDiagram,
  ScrawlNode,
  ScrawlEdge,
  ScrawlGroup,
  ScrawlChart,
  ChartSeries,
  ScrawlComponent,
  DiagramMeta,
  Direction,
  ShapeType,
  EdgeStyle,
  ArrowType,
  ChartKind,
  ChartLegendPosition,
  ChartGridMode,
  ChartPointMode,
  ChartStackMode,
  ChartCurveMode,
  ChartLabelMode,
  ChartSeriesType,
  ChartAxis,
  ChartReferenceLine,
  ChartAnnotation,
  ChartFlowLink,
  ChartCell,
  ChartHierarchyItem,
  ChartThreshold,
  WireframeKind,
  StylePreset,
  RouteTurn,
  WireframeRouteStep,
  SequenceNote,
} from '../ir/types.js'
import { DIRECTIONS, STYLE_PRESETS } from './schema.js'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface NodeAttrs {
  id: string
  label: string
  shape: ShapeType
  color?: string
}

interface EdgeAttrs {
  style: EdgeStyle
  arrow: ArrowType
}

interface SequenceForkLine {
  from: NodeAttrs
  targets: NodeAttrs[]
}

interface SequenceJoinLine {
  from: NodeAttrs[]
  to: NodeAttrs
}

// ---------------------------------------------------------------------------
// Arrow tokenizer
// ---------------------------------------------------------------------------

// Split a line on arrow tokens: <->, ->, =>, ..>, ---
// Returns alternating [nodeExpr, arrowToken, nodeExpr, arrowToken, nodeExpr, ...]
const ARROW_RE = /(<->|->|=>|\.\.>|---)/

function tokenizeLine(line: string): string[] {
  return line.split(ARROW_RE)
}

function parseArrow(token: string): EdgeAttrs {
  switch (token) {
    case '->':  return { style: 'solid',  arrow: 'arrow' }
    case '=>':  return { style: 'dashed', arrow: 'arrow' }
    case '..>': return { style: 'dotted', arrow: 'arrow' }
    case '---': return { style: 'solid',  arrow: 'none'  }
    case '<->': return { style: 'solid',  arrow: 'both'  }
    default:    return { style: 'solid',  arrow: 'arrow' }
  }
}

// ---------------------------------------------------------------------------
// Node expression parser
// ---------------------------------------------------------------------------

// id chars: word chars, hyphens
const ID_RE = /^[\w-]+/

function stripColor(expr: string): { expr: string; color?: string } {
  // Color suffix is ~word at the very end, after all brackets
  const m = expr.match(/^(.*?)~(\w+)$/)
  if (m) return { expr: m[1], color: m[2] }
  return { expr }
}

function parseNodeExpr(raw: string): NodeAttrs {
  const trimmed = raw.trim()
  const { expr, color } = stripColor(trimmed)

  // 1. id[(Label)] — cylinder (must check before id(Label))
  const cylinderM = expr.match(/^([\w-]+)\[\((.+)\)\]$/)
  if (cylinderM) {
    return { id: cylinderM[1], label: cylinderM[2], shape: 'y', color }
  }

  // 2. id((Label)) — circle (must check before id(Label))
  const circleM = expr.match(/^([\w-]+)\(\((.+)\)\)$/)
  if (circleM) {
    return { id: circleM[1], label: circleM[2], shape: 'c', color }
  }

  // 3. id(Label) — rounded
  const roundedM = expr.match(/^([\w-]+)\((.+)\)$/)
  if (roundedM) {
    return { id: roundedM[1], label: roundedM[2], shape: 'r', color }
  }

  // 4. id{Label} — diamond
  const diamondM = expr.match(/^([\w-]+)\{(.+)\}$/)
  if (diamondM) {
    return { id: diamondM[1], label: diamondM[2], shape: 'd', color }
  }

  // 5. id:Label — box with explicit label
  const colonIdx = expr.indexOf(':')
  if (colonIdx !== -1) {
    const id = expr.slice(0, colonIdx).trim()
    const label = expr.slice(colonIdx + 1).trim()
    if (ID_RE.test(id) && label.length > 0) {
      return { id, label, shape: 'b', color }
    }
  }

  // 6. bare id — box, label = id
  const bareM = expr.match(/^[\w-]+$/)
  if (bareM) {
    return { id: expr, label: expr, shape: 'b', color }
  }

  throw new Error(`Cannot parse node expression: "${raw}"`)
}

// ---------------------------------------------------------------------------
// Group line parser: [Label: a b c] or [id|Label: a b c]
// ---------------------------------------------------------------------------

function parseGroupLine(line: string): ScrawlGroup {
  // Strip outer brackets
  const inner = line.slice(1, line.lastIndexOf(']')).trim()

  // Split on first ':'
  const colonIdx = inner.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Group line missing ':': "${line}"`)
  }

  const header = inner.slice(0, colonIdx).trim()
  const body = inner.slice(colonIdx + 1).trim()
  const nodeIds = body.split(/\s+/).filter(s => s.length > 0)

  // header is either "id|Label" or just "Label"
  const pipeIdx = header.indexOf('|')
  let id: string
  let label: string | undefined

  if (pipeIdx !== -1) {
    id = header.slice(0, pipeIdx).trim()
    label = header.slice(pipeIdx + 1).trim() || undefined
  } else {
    // header is the label; derive id from it (lowercase, spaces→underscores)
    label = header || undefined
    id = header.toLowerCase().replace(/\s+/g, '_') || `group_${Math.random().toString(36).slice(2, 7)}`
  }

  return { id, label, nodeIds }
}

// ---------------------------------------------------------------------------
// Edge line parser
// ---------------------------------------------------------------------------

function parseEdgeLine(
  line: string,
  nodeMap: Map<string, NodeAttrs>,
  edges: ScrawlEdge[],
) {
  const parts = tokenizeLine(line)
  // parts = [nodeExpr, arrowToken, nodeExpr, arrowToken, nodeExpr, ...]
  // Must have at least 3 parts (one arrow)
  if (parts.length < 3) return

  // Check for fan-out: last nodeExpr part starts with '{'
  const lastPart = parts[parts.length - 1].trim()
  if (lastPart.startsWith('{')) {
    // Fan-out: a->{b,c,d}
    // There should be exactly one arrow token (parts.length === 3)
    const sourceExpr = parts[0].trim()
    const arrowToken = parts[1].trim()
    const fanExpr = lastPart

    const arrowAttrs = parseArrow(arrowToken)
    const sourceAttrs = parseNodeExpr(sourceExpr)
    registerNode(sourceAttrs, nodeMap)

    // Parse targets from {b,c,d}
    const targetsStr = fanExpr.slice(1, fanExpr.lastIndexOf('}')).trim()
    const targetExprs = targetsStr.split(',').map(s => s.trim()).filter(s => s.length > 0)

    for (const targetExpr of targetExprs) {
      const targetAttrs = parseNodeExpr(targetExpr)
      registerNode(targetAttrs, nodeMap)
      edges.push({
        from: sourceAttrs.id,
        to: targetAttrs.id,
        style: arrowAttrs.style,
        arrow: arrowAttrs.arrow,
      })
    }
    return
  }

  // Chain: a->b->c->d
  // parts = [n0, arrow0, n1, arrow1, n2, ...]
  const firstExpr = parts[0].trim()
  let currentAttrs = parseNodeExpr(firstExpr)
  registerNode(currentAttrs, nodeMap)

  for (let i = 1; i + 1 < parts.length; i += 2) {
    const arrowToken = parts[i].trim()
    const toRaw = parts[i + 1].trim()
    const arrowAttrs = parseArrow(arrowToken)

    // Edge label: split toRaw on first '|'
    let toExpr = toRaw
    let edgeLabel: string | undefined

    const pipeIdx = toRaw.indexOf('|')
    if (pipeIdx !== -1) {
      toExpr = toRaw.slice(0, pipeIdx).trim()
      edgeLabel = toRaw.slice(pipeIdx + 1).trim() || undefined
    }

    const toAttrs = parseNodeExpr(toExpr)
    registerNode(toAttrs, nodeMap)

    edges.push({
      from: currentAttrs.id,
      to: toAttrs.id,
      label: edgeLabel,
      style: arrowAttrs.style,
      arrow: arrowAttrs.arrow,
    })

    currentAttrs = toAttrs
  }
}

// ---------------------------------------------------------------------------
// Node registration: first mention defines attrs; later mentions are no-ops
// ---------------------------------------------------------------------------

function registerNode(attrs: NodeAttrs, nodeMap: Map<string, NodeAttrs>) {
  if (!nodeMap.has(attrs.id)) {
    nodeMap.set(attrs.id, attrs)
  }
  // Later occurrences in chains/fanouts do nothing — first definition wins
}

// ---------------------------------------------------------------------------
// Standalone node line: a line that has no arrow tokens
// ---------------------------------------------------------------------------

function isStandaloneNodeLine(line: string): boolean {
  return !ARROW_RE.test(line) && !line.startsWith('[')
}

// ---------------------------------------------------------------------------
// Wireframe parser
// ---------------------------------------------------------------------------

const WIREFRAME_KINDS = new Set<WireframeKind>([
  'screen',
  'header',
  'sidebar',
  'row',
  'column',
  'panel',
  'card',
  'button',
  'input',
  'textarea',
  'image',
  'text',
  'list',
  'tabs',
  'table',
  'checkbox',
  'radio',
  'select',
  'avatar',
  'badge',
  'modal',
  'toast',
  'chart',
])

const WIREFRAME_ALIGNMENTS = new Set(['start', 'center', 'end', 'between'])
const WIREFRAME_FLOW_RE = /^flow\s+([\w-]+)\s*->\s*([\w-]+)(.*)$/
const FLOW_ROUTE_TURNS = new Set<RouteTurn>(['up', 'down', 'left', 'right'])
const CHART_KINDS = new Set<ChartKind>([
  'bar',
  'line',
  'scatter',
  'area',
  'pie',
  'donut',
  'combo',
  'waterfall',
  'heatmap',
  'radar',
  'radial-bar',
  'treemap',
  'sunburst',
  'funnel',
  'sankey',
  'gauge',
  'likert',
  'box',
  'dot',
  'tornado',
])
const CHART_LEGEND_POSITIONS = new Set<ChartLegendPosition>(['right', 'top', 'bottom', 'none'])
const CHART_GRID_MODES = new Set<ChartGridMode>(['none', 'x', 'y', 'both'])
const CHART_POINT_MODES = new Set<ChartPointMode>(['show', 'hide', 'auto'])
const CHART_STACK_MODES = new Set<ChartStackMode>(['grouped', 'stacked', 'percent'])
const CHART_CURVE_MODES = new Set<ChartCurveMode>(['linear', 'smooth', 'step'])
const CHART_LABEL_MODES = new Set<ChartLabelMode>(['show', 'hide', 'auto'])
const CHART_SERIES_TYPES = new Set<ChartSeriesType>(['bar', 'line', 'area', 'scatter'])
const CHART_AXES = new Set<ChartAxis>(['left', 'right'])

function sanitizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'component'
}

function parseSizeToken(token: string | undefined): { width?: number; height?: number } {
  if (!token) return {}
  const m = token.match(/^(\d+)x(\d+)$/)
  if (!m) return {}
  return { width: Number(m[1]), height: Number(m[2]) }
}

function parseWireframeLine(
  line: string,
  index: number,
  autoIds: Map<string, number>,
): Omit<ScrawlComponent, 'parentId' | 'depth'> {
  const trimmed = line.trim()
  const firstSpace = trimmed.indexOf(' ')
  const kindRaw = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)
  if (!WIREFRAME_KINDS.has(kindRaw as WireframeKind)) {
    throw new Error(`Unknown wireframe component: "${kindRaw}" on line ${index + 1}`)
  }

  const kind = kindRaw as WireframeKind
  let remainder = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim()

  const optionEntries: Array<[string, string]> = []
  const optionMatches = [...remainder.matchAll(/(?:^|\s)(align|gap|span|variant|w|h)=([^\s]+)/g)]
  for (const match of optionMatches) {
    optionEntries.push([match[1]!, match[2]!])
  }
  remainder = remainder.replace(/(?:^|\s)(align|gap|span|variant|w|h)=([^\s]+)/g, ' ').trim()

  let sizeToken: string | undefined
  const sizeMatch = remainder.match(/(?:^|\s)(\d+x\d+)$/)
  if (sizeMatch) {
    sizeToken = sizeMatch[1]
    remainder = remainder.slice(0, remainder.length - sizeToken.length).trim()
  }

  let id = ''
  let label = ''
  if (remainder.length === 0) {
    const count = (autoIds.get(kind) ?? 0) + 1
    autoIds.set(kind, count)
    id = `${kind}_${count}`
    label = kind === 'screen' ? 'Screen' : kind[0].toUpperCase() + kind.slice(1)
  } else {
    const colonIdx = remainder.indexOf(':')
    if (colonIdx === -1) {
      id = sanitizeId(remainder)
      label = remainder
    } else {
      id = sanitizeId(remainder.slice(0, colonIdx))
      label = remainder.slice(colonIdx + 1).trim()
      if (!label) label = id
    }
  }

  const size = parseSizeToken(sizeToken)
  let width = size.width
  let height = size.height
  let span: number | undefined
  let gap: number | undefined
  let align: ScrawlComponent['align']
  let variant: string | undefined

  for (const [key, value] of optionEntries) {
    switch (key) {
      case 'w':
        width = Number(value)
        break
      case 'h':
        height = Number(value)
        break
      case 'span':
        span = Number(value)
        break
      case 'gap':
        gap = Number(value)
        break
      case 'align':
        if (!WIREFRAME_ALIGNMENTS.has(value)) {
          throw new Error(`Unknown wireframe align "${value}" on line ${index + 1}`)
        }
        align = value as ScrawlComponent['align']
        break
      case 'variant':
        variant = value
        break
    }
  }

  return {
    id,
    kind,
    label,
    width,
    height,
    span,
    gap,
    align,
    variant,
  }
}

function parseWireframeFlowLine(line: string, index: number): NonNullable<ScrawlDiagram['flows']>[number] {
  const match = line.match(WIREFRAME_FLOW_RE)
  if (!match) {
    throw new Error(`Invalid wireframe flow syntax on line ${index + 1}`)
  }

  const from = match[1]!
  const to = match[2]!
  let tail = match[3]?.trim() ?? ''
  let label: string | undefined

  const pipeIdx = tail.indexOf('|')
  if (pipeIdx !== -1) {
    label = tail.slice(pipeIdx + 1).trim() || undefined
    tail = tail.slice(0, pipeIdx).trim()
  }

  let route: WireframeRouteStep[] | undefined
  const routeMatch = tail.match(/(?:^|\s)(?:route|turns)=([^\|]+)$/)
  if (routeMatch) {
    route = routeMatch[1]!
      .trim()
      .split(/[,\s]+/)
      .map(turn => turn.trim().toLowerCase())
      .filter(turn => turn.length > 0)
      .flatMap(turn => {
        const scaled = turn.match(/^(up|down|left|right)\*(\d+)$/)
        if (scaled) {
          const direction = scaled[1] as RouteTurn
          const count = Number(scaled[2])
          if (!Number.isFinite(count) || count < 1) {
            throw new Error(`Invalid wireframe flow repeat "${turn}" on line ${index + 1}`)
          }
          return Array.from({ length: count }, () => ({ direction }))
        }

        const measured = turn.match(/^(up|down|left|right):(\d+)$/)
        if (measured) {
          return [{
            direction: measured[1] as RouteTurn,
            distance: Number(measured[2]),
          }]
        }

        return [{ direction: turn as RouteTurn }]
      })

    if (route.length === 0) {
      throw new Error(`Wireframe flow route is empty on line ${index + 1}`)
    }

    for (const step of route) {
      if (!FLOW_ROUTE_TURNS.has(step.direction)) {
        throw new Error(`Unknown wireframe flow turn "${step.direction}" on line ${index + 1}`)
      }
      if (step.distance != null && (!Number.isFinite(step.distance) || step.distance <= 0)) {
        throw new Error(`Invalid wireframe flow distance "${step.distance}" on line ${index + 1}`)
      }
    }

    tail = tail.replace(routeMatch[0], '').trim()
  }

  if (tail.length > 0) {
    throw new Error(`Unknown wireframe flow options "${tail}" on line ${index + 1}`)
  }

  return {
    from,
    to,
    label,
    route,
  }
}

function parseWireframe(source: string): ScrawlDiagram {
  const lines = source.split('\n').map(line => {
    const hashIdx = line.indexOf('#')
    return hashIdx === -1 ? line : line.slice(0, hashIdx)
  })

  const components: ScrawlComponent[] = []
  const flows: ScrawlDiagram['flows'] = []
  const autoIds = new Map<string, number>()
  const stack: Array<{ indent: number; id: string }> = []
  const ids = new Set<string>()
  let style: StylePreset = 'sketch'
  let theme: 'rough' | 'clean' = 'rough'

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    if (!raw.trim()) continue
    if (raw.trim() === 'wireframe') continue

    const trimmed = raw.trim()
    if (trimmed.startsWith('style ')) {
      const styleName = trimmed.slice('style '.length).trim()
      if (!(STYLE_PRESETS as readonly string[]).includes(styleName)) {
        throw new Error(`Unknown wireframe style: "${styleName}"`)
      }
      style = styleName as StylePreset
      theme = style === 'clean' || style === 'blueprint' ? 'clean' : 'rough'
      continue
    }

    const flowMatch = trimmed.match(WIREFRAME_FLOW_RE)
    if (flowMatch) {
      flows.push(parseWireframeFlowLine(trimmed, i))
      continue
    }

    const indentMatch = raw.match(/^ */)
    const indent = indentMatch?.[0].length ?? 0
    if (indent % 2 !== 0) {
      throw new Error(`Wireframe indentation must use multiples of 2 spaces on line ${i + 1}`)
    }
    const depth = indent / 2

    const parsed = parseWireframeLine(raw, i, autoIds)
    if (ids.has(parsed.id)) throw new Error(`Duplicate component id: "${parsed.id}"`)
    ids.add(parsed.id)

    while (stack.length > depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (depth > 0 && !parent) {
      throw new Error(`Invalid wireframe indentation on line ${i + 1}`)
    }
    if (depth === 0 && parsed.kind !== 'screen') {
      throw new Error(`Wireframe roots must be screen components (line ${i + 1})`)
    }

    const component: ScrawlComponent = {
      ...parsed,
      parentId: parent?.id,
      depth,
    }
    components.push(component)
    stack.push({ indent: depth, id: component.id })
  }

  if (components.length === 0) {
    return {
      meta: { dir: 'lr', theme: 'rough', kind: 'wireframe' },
      nodes: [],
      edges: [],
      groups: [],
      components: [],
      flows: [],
    }
  }

  for (const flow of flows) {
    if (!ids.has(flow.from)) throw new Error(`Unknown wireframe flow source: "${flow.from}"`)
    if (!ids.has(flow.to)) throw new Error(`Unknown wireframe flow target: "${flow.to}"`)
  }

  return {
    meta: { dir: 'lr', theme, kind: 'wireframe', style },
    nodes: [],
    edges: [],
    groups: [],
    components,
    flows,
  }
}

function parseSequenceHeader(line: string, index: number): Pick<DiagramMeta, 'sequenceWrap' | 'sequenceRowGap' | 'sequenceColumnGap' | 'sequenceSnake'> {
  const trimmed = line.trim()
  if (!trimmed.startsWith('sequence')) {
    throw new Error('Sequence mode must start with "sequence"')
  }

  const tail = trimmed.slice('sequence'.length).trim()
  if (!tail) return {}

  const options: Pick<DiagramMeta, 'sequenceWrap' | 'sequenceRowGap' | 'sequenceColumnGap' | 'sequenceSnake'> = {}
  const tokens = tail.split(/\s+/).filter(Boolean)

  for (const token of tokens) {
    const [key, rawValue] = token.split('=')
    if (!key || rawValue == null) {
      throw new Error(`Invalid sequence option "${token}" on line ${index + 1}`)
    }

    switch (key) {
      case 'wrap':
      case 'rowgap':
      case 'colgap': {
        const value = Number(rawValue)
        if (!Number.isInteger(value) || value < 1) {
          throw new Error(`Invalid sequence ${key} "${rawValue}" on line ${index + 1}`)
        }
        if (key === 'wrap') options.sequenceWrap = value
        if (key === 'rowgap') options.sequenceRowGap = value
        if (key === 'colgap') options.sequenceColumnGap = value
        break
      }
      case 'snake':
        if (rawValue !== 'horizontal' && rawValue !== 'vertical') {
          throw new Error(`Invalid sequence snake "${rawValue}" on line ${index + 1}`)
        }
        options.sequenceSnake = rawValue
        break
      default:
        throw new Error(`Unknown sequence option "${key}" on line ${index + 1}`)
    }
  }

  return options
}

function parseSequenceSectionLine(
  line: string,
  index: number,
  usedIds: Set<string>,
): { id: string; label: string } {
  const match = line.match(/^(phase|lane)\s+(.+)$/)
  if (!match) {
    throw new Error(`Invalid sequence section syntax on line ${index + 1}`)
  }

  const remainder = match[2]!.trim()
  if (!remainder) {
    throw new Error(`Sequence section label is empty on line ${index + 1}`)
  }

  const colonIdx = remainder.indexOf(':')
  const rawLabel = colonIdx === -1 ? remainder : remainder.slice(colonIdx + 1).trim() || remainder.slice(0, colonIdx).trim()
  const label = normalizeSequenceAnnotationLabel(rawLabel, 18)
  const rawId = colonIdx === -1 ? remainder : remainder.slice(0, colonIdx).trim()
  const kind = match[1]!
  const baseId = sanitizeId(`${kind}_${rawId || label}`)
  let id = baseId
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${baseId}_${suffix}`
    suffix += 1
  }
  usedIds.add(id)
  return { id, label }
}

function addNodesToSequenceGroup(group: ScrawlGroup | undefined, ids: string[]) {
  if (!group) return
  for (const id of ids) {
    if (!group.nodeIds.includes(id)) group.nodeIds.push(id)
  }
}

function wrapSequenceAnnotationLine(line: string, maxLength: number): string[] {
  if (line.length <= maxLength) return [line]

  const wrapped: string[] = []
  let current = ''
  const words = line.split(/\s+/).filter(Boolean)

  for (const word of words) {
    if (word.length > maxLength) {
      if (current) {
        wrapped.push(current)
        current = ''
      }
      for (let index = 0; index < word.length; index += maxLength) {
        wrapped.push(word.slice(index, index + maxLength))
      }
      continue
    }

    if (!current) {
      current = word
      continue
    }

    if (current.length + 1 + word.length <= maxLength) {
      current = `${current} ${word}`
      continue
    }

    wrapped.push(current)
    current = word
  }

  if (current) wrapped.push(current)
  return wrapped.length > 0 ? wrapped : ['']
}

function normalizeSequenceAnnotationLabel(raw: string, maxLineLength: number): string {
  const normalized = raw
    .replace(/\\n/g, '\n')
    .split('\n')
    .map(line => line.trim().replace(/\s+/g, ' '))
    .flatMap(line => wrapSequenceAnnotationLine(line, maxLineLength))
    .filter(line => line.length > 0)

  return normalized.join('\n')
}

function parseSequenceNoteLine(line: string, index: number): SequenceNote {
  const match = line.match(/^note\s+(left|right)\s+of\s+([\w-]+)\s*:\s*(.+)$/)
    ?? line.match(/^note\s+(over)\s+([\w-]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid sequence note syntax on line ${index + 1}`)
  }

  return {
    placement: match[1] as SequenceNote['placement'],
    target: match[2]!,
    label: normalizeSequenceAnnotationLabel(match[3]!.trim(), 24),
  }
}

function parseSequenceForkLine(line: string, index: number): SequenceForkLine {
  const match = line.match(/^fork\s+(.+?)\s*->\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid sequence fork syntax on line ${index + 1}`)
  }

  const from = parseNodeExpr(match[1]!.trim())
  const targets = match[2]!
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => parseNodeExpr(entry))

  if (targets.length < 2) {
    throw new Error(`Sequence fork must define at least two targets on line ${index + 1}`)
  }

  return { from, targets }
}

function parseSequenceJoinLine(line: string, index: number): SequenceJoinLine {
  const match = line.match(/^join\s+(.+?)\s*->\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid sequence join syntax on line ${index + 1}`)
  }

  const from = match[1]!
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => parseNodeExpr(entry))
  const to = parseNodeExpr(match[2]!.trim())

  if (from.length < 2) {
    throw new Error(`Sequence join must define at least two sources on line ${index + 1}`)
  }

  return { from, to }
}

function parseSequence(source: string): ScrawlDiagram {
  const lines = source.split('\n').map(line => {
    const hashIdx = line.indexOf('#')
    return hashIdx === -1 ? line : line.slice(0, hashIdx)
  })

  const meaningful: Array<{ text: string; line: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trim()
    if (!text) continue
    meaningful.push({ text, line: i })
  }

  const header = meaningful[0]
  const headerOptions = parseSequenceHeader(header?.text ?? '', header?.line ?? 0)

  let style: StylePreset = 'sketch'
  let theme: 'rough' | 'clean' = 'rough'
  const nodeMap = new Map<string, NodeAttrs>()
  const definitionOrder: string[] = []
  const edges: ScrawlEdge[] = []
  const notes: SequenceNote[] = []
  const sequenceBreaks: number[] = []
  const sequenceGroups: ScrawlGroup[] = []
  const sequenceGroupIds = new Set<string>()
  let currentGroup: ScrawlGroup | undefined
  let pendingBreak = false
  const pushBreakIfNeeded = () => {
    if (pendingBreak) {
      sequenceBreaks.push(definitionOrder.length)
      pendingBreak = false
    }
  }

  const addSequenceNode = (attrs: NodeAttrs): boolean => {
    if (nodeMap.has(attrs.id)) return false
    nodeMap.set(attrs.id, attrs)
    definitionOrder.push(attrs.id)
    return true
  }

  for (let i = 1; i < meaningful.length; i++) {
    const entry = meaningful[i]!
    if (entry.text.startsWith('style ')) {
      const styleName = entry.text.slice('style '.length).trim()
      if (!(STYLE_PRESETS as readonly string[]).includes(styleName)) {
        throw new Error(`Unknown sequence style: "${styleName}"`)
      }
      style = styleName as StylePreset
      theme = style === 'clean' || style === 'blueprint' ? 'clean' : 'rough'
      continue
    }

    if (entry.text === 'break') {
      if (definitionOrder.length === 0) {
        throw new Error(`Sequence break cannot appear before the first step (line ${entry.line + 1})`)
      }
      if (pendingBreak) {
        throw new Error(`Sequence break must be followed by a step before another break (line ${entry.line + 1})`)
      }
      pendingBreak = true
      continue
    }

    if (entry.text.startsWith('note ')) {
      notes.push(parseSequenceNoteLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('phase ') || entry.text.startsWith('lane ')) {
      const section = parseSequenceSectionLine(entry.text, entry.line, sequenceGroupIds)
      currentGroup = { id: section.id, label: section.label, nodeIds: [] }
      sequenceGroups.push(currentGroup)
      continue
    }

    if (entry.text.startsWith('fork ')) {
      const fork = parseSequenceForkLine(entry.text, entry.line)
      const willAddSource = !nodeMap.has(fork.from.id)
      const willAddTarget = fork.targets.some(target => !nodeMap.has(target.id))
      if (willAddSource || willAddTarget) pushBreakIfNeeded()
      const addedIds: string[] = []
      if (addSequenceNode(fork.from)) addedIds.push(fork.from.id)
      for (const target of fork.targets) {
        if (addSequenceNode(target)) addedIds.push(target.id)
        edges.push({
          from: fork.from.id,
          to: target.id,
          style: 'solid',
          arrow: 'arrow',
        })
      }
      addNodesToSequenceGroup(currentGroup, addedIds)
      continue
    }

    if (entry.text.startsWith('join ')) {
      const join = parseSequenceJoinLine(entry.text, entry.line)
      const willAddSource = join.from.some(sourceNode => !nodeMap.has(sourceNode.id))
      const willAddTarget = !nodeMap.has(join.to.id)
      if (willAddSource || willAddTarget) pushBreakIfNeeded()
      const addedIds: string[] = []
      for (const sourceNode of join.from) {
        if (addSequenceNode(sourceNode)) addedIds.push(sourceNode.id)
      }
      if (addSequenceNode(join.to)) addedIds.push(join.to.id)
      for (const sourceNode of join.from) {
        edges.push({
          from: sourceNode.id,
          to: join.to.id,
          style: 'solid',
          arrow: 'arrow',
        })
      }
      addNodesToSequenceGroup(currentGroup, addedIds)
      continue
    }

    if (entry.text.startsWith('[')) {
      throw new Error(`Sequence mode does not support groups on line ${entry.line + 1}`)
    }

    if (isStandaloneNodeLine(entry.text)) {
      const attrs = parseNodeExpr(entry.text)
      if (nodeMap.has(attrs.id)) {
        const existing = nodeMap.get(attrs.id)!
        const isDiff =
          existing.shape !== attrs.shape ||
          existing.label !== attrs.label ||
          existing.color !== attrs.color
        if (isDiff) {
          throw new Error(`Duplicate sequence step id: "${attrs.id}"`)
        }
        continue
      }

      pushBreakIfNeeded()
      nodeMap.set(attrs.id, attrs)
      definitionOrder.push(attrs.id)
      addNodesToSequenceGroup(currentGroup, [attrs.id])
      continue
    }

    const beforeSize = nodeMap.size
    const beforeEdges = edges.length
    parseEdgeLine(entry.text, nodeMap, edges)
    if (nodeMap.size === beforeSize && edges.length === beforeEdges) {
      throw new Error(`Sequence mode could not parse line ${entry.line + 1}`)
    }
    if (pendingBreak && nodeMap.size > beforeSize) pushBreakIfNeeded()
    const addedIds: string[] = []
    for (const [id] of nodeMap) {
      if (!definitionOrder.includes(id)) {
        definitionOrder.push(id)
        addedIds.push(id)
      }
    }
    addNodesToSequenceGroup(currentGroup, addedIds)
  }

  if (pendingBreak) {
    throw new Error('Sequence break must be followed by a step')
  }

  const nodes: ScrawlNode[] = definitionOrder.map(id => {
    const attrs = nodeMap.get(id)!
    const node: ScrawlNode = {
      id: attrs.id,
      label: attrs.label,
      shape: attrs.shape,
    }
    if (attrs.color !== undefined) node.color = attrs.color
    return node
  })

  const sequenceEdges: ScrawlEdge[] = edges.length > 0
    ? edges
    : definitionOrder.slice(1).map((id, index) => ({
        from: definitionOrder[index]!,
        to: id,
        style: 'solid',
        arrow: 'arrow',
      }))

  for (const note of notes) {
    if (!nodeMap.has(note.target)) {
      throw new Error(`Unknown sequence note target: "${note.target}"`)
    }
  }

  return {
    meta: { dir: 'lr', theme, kind: 'sequence', style, ...headerOptions },
    nodes,
    edges: sequenceEdges,
    groups: sequenceGroups.filter(group => group.nodeIds.length > 0),
    notes,
    sequenceBreaks,
  }
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1)
  }
  return value
}

function extractTrailingChartOptions(text: string) {
  const options: Record<string, string> = {}
  let remainder = text

  for (const key of ['label', 'color']) {
    const re = new RegExp(`(?:^|\\s)${key}=("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\\S+)`)
    const match = remainder.match(re)
    if (match) {
      options[key] = unquote(match[1]!)
      remainder = remainder.replace(match[0], ' ').trim()
    }
  }

  return { remainder: remainder.trim(), options }
}

function parseChartSeriesOptions(raw: string | undefined, index: number): Omit<ChartSeries, 'name' | 'values' | 'points'> {
  if (!raw) return {}
  const options: Omit<ChartSeries, 'name' | 'values' | 'points'> = {}
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    const eqIdx = token.indexOf('=')
    if (eqIdx === -1) {
      throw new Error(`Invalid chart series option "${token}" on line ${index + 1}`)
    }
    const key = token.slice(0, eqIdx).trim()
    const value = token.slice(eqIdx + 1).trim()
    switch (key) {
      case 'type':
        if (!CHART_SERIES_TYPES.has(value as ChartSeriesType)) {
          throw new Error(`Unknown chart series type "${value}" on line ${index + 1}`)
        }
        options.type = value as ChartSeriesType
        break
      case 'axis':
        if (!CHART_AXES.has(value as ChartAxis)) {
          throw new Error(`Unknown chart series axis "${value}" on line ${index + 1}`)
        }
        options.axis = value as ChartAxis
        break
      case 'color':
        options.color = value
        break
      case 'curve':
        if (!CHART_CURVE_MODES.has(value as ChartCurveMode)) {
          throw new Error(`Unknown chart series curve "${value}" on line ${index + 1}`)
        }
        options.curve = value as ChartCurveMode
        break
      case 'labels':
        if (!CHART_LABEL_MODES.has(value as ChartLabelMode)) {
          throw new Error(`Unknown chart series labels mode "${value}" on line ${index + 1}`)
        }
        options.labels = value as ChartLabelMode
        break
      default:
        throw new Error(`Unknown chart series option "${key}" on line ${index + 1}`)
    }
  }
  return options
}

function parseChartPointsPayload(payload: string, index: number) {
  return payload
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const coords = entry.split(',').map(part => Number(part.trim()))
      if (coords.length !== 2 || coords.some(value => !Number.isFinite(value))) {
        throw new Error(`Invalid chart point "${entry}" on line ${index + 1}`)
      }
      return [coords[0]!, coords[1]!] as [number, number]
    })
}

function parseChartValuesPayload(payload: string, index: number, name: string) {
  const parts = payload.split(',').map(entry => entry.trim())
  const values = parts.map(entry => Number(entry))
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new Error(`Invalid numeric values in chart series "${name}" on line ${index + 1}`)
  }
  return values
}

function parseChartSeriesLine(line: string, index: number, kind: ChartKind): ChartSeries {
  const match = line.match(/^series\s+(.+?)(?:\s+\[([^\]]+)\])?\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart series syntax on line ${index + 1}`)
  }

  const name = match[1]!.trim()
  const payload = match[3]!.trim()
  if (!name) {
    throw new Error(`Chart series name is empty on line ${index + 1}`)
  }
  if (!payload) {
    throw new Error(`Chart series "${name}" is empty on line ${index + 1}`)
  }

  const seriesOptions = parseChartSeriesOptions(match[2], index)
  const seriesType = seriesOptions.type ?? (kind === 'combo' ? 'bar' : kind === 'scatter' ? 'scatter' : kind === 'area' ? 'area' : kind === 'line' ? 'line' : kind === 'bar' ? 'bar' : undefined)

  if (kind === 'scatter' || seriesType === 'scatter') {
    const points = parseChartPointsPayload(payload, index)
    if (points.length === 0) {
      throw new Error(`Scatter series "${name}" is empty on line ${index + 1}`)
    }
    return { name, points, ...seriesOptions, type: 'scatter' }
  }

  const values = parseChartValuesPayload(payload, index, name)
  return { name, values, ...seriesOptions }
}

function parseChartRefLine(line: string, index: number): ChartReferenceLine {
  const match = line.match(/^ref\s+(x|y|y2)\s+(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart ref syntax on line ${index + 1}`)
  }
  const axis = match[1] as ChartReferenceLine['axis']
  const { remainder, options } = extractTrailingChartOptions(match[2]!)
  const value = Number(remainder)
  const parsedValue = Number.isFinite(value) ? value : remainder
  return {
    axis,
    value: parsedValue,
    label: options.label,
    color: options.color,
  }
}

function parseChartAnnotationLine(line: string, index: number): ChartAnnotation {
  const match = line.match(/^annotate\s+([^,]+)\s*,\s*([^:]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart annotation syntax on line ${index + 1}`)
  }
  const xRaw = match[1]!.trim()
  const y = Number(match[2]!.trim())
  if (!Number.isFinite(y)) {
    throw new Error(`Invalid chart annotation y value on line ${index + 1}`)
  }
  const { remainder, options } = extractTrailingChartOptions(match[3]!.trim())
  if (!remainder) {
    throw new Error(`Chart annotation label is empty on line ${index + 1}`)
  }
  const x = Number(xRaw)
  return {
    x: Number.isFinite(x) ? x : xRaw,
    y,
    label: remainder,
    color: options.color,
  }
}

function parseChartFlowLine(line: string, index: number): ChartFlowLink {
  const match = line.match(/^flow\s+([^\s]+)\s*->\s*([^\s]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart flow syntax on line ${index + 1}`)
  }
  const value = Number(match[3]!.trim())
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid chart flow value on line ${index + 1}`)
  }
  return { from: match[1]!, to: match[2]!, value }
}

function parseChartCellLine(line: string, index: number): ChartCell {
  const match = line.match(/^cell\s+([^,]+)\s*,\s*([^:]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart cell syntax on line ${index + 1}`)
  }
  const value = Number(match[3]!.trim())
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid heatmap cell value on line ${index + 1}`)
  }
  return {
    row: match[1]!.trim(),
    column: match[2]!.trim(),
    value,
  }
}

function parseChartItemLine(line: string, index: number): ChartHierarchyItem {
  const match = line.match(/^item\s+([^:]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid chart item syntax on line ${index + 1}`)
  }
  const path = match[1]!.split('/').map(part => part.trim()).filter(Boolean)
  const value = Number(match[2]!.trim())
  if (path.length === 0 || !Number.isFinite(value)) {
    throw new Error(`Invalid chart item on line ${index + 1}`)
  }
  return { path, value }
}

function parseChartThresholdLine(line: string, index: number): ChartThreshold {
  const match = line.match(/^threshold\s+(\S+)\s+(\S+)(?:\s+(.+))?$/)
  if (!match) {
    throw new Error(`Invalid chart threshold syntax on line ${index + 1}`)
  }
  const upto = Number(match[1]!)
  if (!Number.isFinite(upto)) {
    throw new Error(`Invalid chart threshold value on line ${index + 1}`)
  }
  return {
    upto,
    color: match[2]!,
    label: match[3]?.trim() || undefined,
  }
}

function parseChart(source: string): ScrawlDiagram {
  const lines = source.split('\n').map(line => line.trimStart().startsWith('#') ? '' : line)

  const meaningful: Array<{ text: string; line: number }> = []
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.trim()
    if (!text) continue
    meaningful.push({ text, line: i })
  }

  const header = meaningful[0]
  if (header?.text !== 'chart') {
    throw new Error('Chart mode must start with "chart"')
  }

  let style: StylePreset = 'sketch'
  let theme: 'rough' | 'clean' = 'rough'
  let kind: ChartKind | undefined
  let title: string | undefined
  let xLabel: string | undefined
  let yLabel: string | undefined
  let categories: string[] | undefined
  let legend: ChartLegendPosition | undefined
  let grid: ChartGridMode | undefined
  let points: ChartPointMode | undefined
  let stack: ChartStackMode | undefined
  let curve: ChartCurveMode | undefined
  let labels: ChartLabelMode | undefined
  let xTickCount: number | undefined
  let yTickCount: number | undefined
  let y2TickCount: number | undefined
  let xMin: number | undefined
  let xMax: number | undefined
  let yMin: number | undefined
  let yMax: number | undefined
  let y2Min: number | undefined
  let y2Max: number | undefined
  let innerRadius: number | undefined
  let target: number | undefined
  const seriesEntries: Array<{ text: string; line: number }> = []
  const references: ChartReferenceLine[] = []
  const annotations: ChartAnnotation[] = []
  const flows: ChartFlowLink[] = []
  const cells: ChartCell[] = []
  const items: ChartHierarchyItem[] = []
  const thresholds: ChartThreshold[] = []

  for (let i = 1; i < meaningful.length; i++) {
    const entry = meaningful[i]!
    if (entry.text.startsWith('style ')) {
      const styleName = entry.text.slice('style '.length).trim()
      if (!(STYLE_PRESETS as readonly string[]).includes(styleName)) {
        throw new Error(`Unknown chart style: "${styleName}"`)
      }
      style = styleName as StylePreset
      theme = style === 'clean' || style === 'blueprint' ? 'clean' : 'rough'
      continue
    }

    if (entry.text.startsWith('kind ')) {
      const rawKind = entry.text.slice('kind '.length).trim()
      if (!CHART_KINDS.has(rawKind as ChartKind)) {
        throw new Error(`Unknown chart kind "${rawKind}" on line ${entry.line + 1}`)
      }
      kind = rawKind as ChartKind
      continue
    }

    if (entry.text.startsWith('title ')) {
      title = entry.text.slice('title '.length).trim()
      continue
    }

    if (entry.text.startsWith('xlabel ')) {
      xLabel = entry.text.slice('xlabel '.length).trim()
      continue
    }

    if (entry.text.startsWith('ylabel ')) {
      yLabel = entry.text.slice('ylabel '.length).trim()
      continue
    }

    if (entry.text.startsWith('categories ')) {
      categories = entry.text
        .slice('categories '.length)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
      if (categories.length === 0) {
        throw new Error(`Chart categories are empty on line ${entry.line + 1}`)
      }
      continue
    }

    if (entry.text.startsWith('legend ')) {
      const value = entry.text.slice('legend '.length).trim()
      if (!CHART_LEGEND_POSITIONS.has(value as ChartLegendPosition)) {
        throw new Error(`Unknown chart legend position "${value}" on line ${entry.line + 1}`)
      }
      legend = value as ChartLegendPosition
      continue
    }

    if (entry.text.startsWith('grid ')) {
      const value = entry.text.slice('grid '.length).trim()
      if (!CHART_GRID_MODES.has(value as ChartGridMode)) {
        throw new Error(`Unknown chart grid mode "${value}" on line ${entry.line + 1}`)
      }
      grid = value as ChartGridMode
      continue
    }

    if (entry.text.startsWith('points ')) {
      const value = entry.text.slice('points '.length).trim()
      if (!CHART_POINT_MODES.has(value as ChartPointMode)) {
        throw new Error(`Unknown chart points mode "${value}" on line ${entry.line + 1}`)
      }
      points = value as ChartPointMode
      continue
    }

    if (entry.text.startsWith('stack ')) {
      const value = entry.text.slice('stack '.length).trim()
      if (!CHART_STACK_MODES.has(value as ChartStackMode)) {
        throw new Error(`Unknown chart stack mode "${value}" on line ${entry.line + 1}`)
      }
      stack = value as ChartStackMode
      continue
    }

    if (entry.text.startsWith('curve ')) {
      const value = entry.text.slice('curve '.length).trim()
      if (!CHART_CURVE_MODES.has(value as ChartCurveMode)) {
        throw new Error(`Unknown chart curve mode "${value}" on line ${entry.line + 1}`)
      }
      curve = value as ChartCurveMode
      continue
    }

    if (entry.text.startsWith('labels ')) {
      const value = entry.text.slice('labels '.length).trim()
      if (!CHART_LABEL_MODES.has(value as ChartLabelMode)) {
        throw new Error(`Unknown chart labels mode "${value}" on line ${entry.line + 1}`)
      }
      labels = value as ChartLabelMode
      continue
    }

    if (entry.text.startsWith('xticks ')) {
      const value = Number(entry.text.slice('xticks '.length).trim())
      if (!Number.isInteger(value) || value < 2) {
        throw new Error(`Invalid chart xticks value on line ${entry.line + 1}`)
      }
      xTickCount = value
      continue
    }

    if (entry.text.startsWith('yticks ')) {
      const value = Number(entry.text.slice('yticks '.length).trim())
      if (!Number.isInteger(value) || value < 2) {
        throw new Error(`Invalid chart yticks value on line ${entry.line + 1}`)
      }
      yTickCount = value
      continue
    }

    if (entry.text.startsWith('xmin ')) {
      const value = Number(entry.text.slice('xmin '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart xmin value on line ${entry.line + 1}`)
      }
      xMin = value
      continue
    }

    if (entry.text.startsWith('xmax ')) {
      const value = Number(entry.text.slice('xmax '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart xmax value on line ${entry.line + 1}`)
      }
      xMax = value
      continue
    }

    if (entry.text.startsWith('ymin ')) {
      const value = Number(entry.text.slice('ymin '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart ymin value on line ${entry.line + 1}`)
      }
      yMin = value
      continue
    }

    if (entry.text.startsWith('ymax ')) {
      const value = Number(entry.text.slice('ymax '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart ymax value on line ${entry.line + 1}`)
      }
      yMax = value
      continue
    }

    if (entry.text.startsWith('y2ticks ')) {
      const value = Number(entry.text.slice('y2ticks '.length).trim())
      if (!Number.isInteger(value) || value < 2) {
        throw new Error(`Invalid chart y2ticks value on line ${entry.line + 1}`)
      }
      y2TickCount = value
      continue
    }

    if (entry.text.startsWith('y2min ')) {
      const value = Number(entry.text.slice('y2min '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart y2min value on line ${entry.line + 1}`)
      }
      y2Min = value
      continue
    }

    if (entry.text.startsWith('y2max ')) {
      const value = Number(entry.text.slice('y2max '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart y2max value on line ${entry.line + 1}`)
      }
      y2Max = value
      continue
    }

    if (entry.text.startsWith('inner ')) {
      const value = Number(entry.text.slice('inner '.length).trim())
      if (!Number.isFinite(value) || value <= 0 || value >= 0.95) {
        throw new Error(`Invalid chart inner value on line ${entry.line + 1}`)
      }
      innerRadius = value
      continue
    }

    if (entry.text.startsWith('target ')) {
      const value = Number(entry.text.slice('target '.length).trim())
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid chart target value on line ${entry.line + 1}`)
      }
      target = value
      continue
    }

    if (entry.text.startsWith('series ')) {
      seriesEntries.push(entry)
      continue
    }

    if (entry.text.startsWith('ref ')) {
      references.push(parseChartRefLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('annotate ')) {
      annotations.push(parseChartAnnotationLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('flow ')) {
      flows.push(parseChartFlowLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('cell ')) {
      cells.push(parseChartCellLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('item ')) {
      items.push(parseChartItemLine(entry.text, entry.line))
      continue
    }

    if (entry.text.startsWith('threshold ')) {
      thresholds.push(parseChartThresholdLine(entry.text, entry.line))
      continue
    }

    throw new Error(`Unknown chart directive on line ${entry.line + 1}: "${entry.text}"`)
  }

  if (!kind) {
    throw new Error('Chart kind is required')
  }
  const series = seriesEntries.map(entry => parseChartSeriesLine(entry.text, entry.line, kind!))
  const chartHasCategoricalSeries = kind === 'bar' || kind === 'line' || kind === 'area' || kind === 'combo' || kind === 'waterfall' || kind === 'radar' || kind === 'radial-bar' || kind === 'funnel' || kind === 'likert' || kind === 'tornado'
  const seriesLengths = new Set(series.map(entry => entry.values?.length ?? entry.points?.length ?? 0))

  if (kind === 'scatter') {
    if (series.length === 0) {
      throw new Error('Scatter charts require at least one series')
    }
    if (categories) {
      throw new Error('Scatter charts do not support categories')
    }
    if (xMin != null && xMax != null && xMin >= xMax) {
      throw new Error('Chart xmin must be less than xmax')
    }
    if (stack != null) {
      throw new Error('Chart stack mode is not supported for scatter charts')
    }
  } else if (kind === 'pie' || kind === 'donut') {
    if (series.length === 0) {
      throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} charts require at least one series`)
    }
    if (xLabel || yLabel) {
      throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} charts do not support x/y axis labels`)
    }
    if (grid != null || points != null || xTickCount != null || yTickCount != null || y2TickCount != null || xMin != null || xMax != null || yMin != null || yMax != null || y2Min != null || y2Max != null || stack != null) {
      throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} charts do not support axis, grid, points, or stack directives`)
    }
    const usingMultiSeries = series.length > 1
    if (usingMultiSeries) {
      if (series.some(entry => (entry.values?.length ?? 0) !== 1)) {
        throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} charts with multiple series require exactly one value per series`)
      }
      if (categories && categories.length !== series.length) {
        throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} chart categories must match the number of series`)
      }
    } else {
      const valueCount = series[0]?.values?.length ?? 0
      if (categories && categories.length !== valueCount) {
        throw new Error(`${kind[0]!.toUpperCase() + kind.slice(1)} chart categories must match the value count`)
      }
    }
  } else if (kind === 'heatmap') {
    if (cells.length === 0) throw new Error('Heatmap charts require at least one cell')
    if (series.length > 0) throw new Error('Heatmap charts do not use series directives')
  } else if (kind === 'treemap' || kind === 'sunburst') {
    if (items.length === 0) throw new Error(`${kind} charts require at least one item`)
    if (series.length > 0) throw new Error(`${kind} charts do not use series directives`)
  } else if (kind === 'sankey') {
    if (flows.length === 0) throw new Error('Sankey charts require at least one flow')
    if (series.length > 0) throw new Error('Sankey charts do not use series directives')
  } else if (kind === 'gauge') {
    if (series.length !== 1 || (series[0]?.values?.length ?? 0) !== 1) {
      throw new Error('Gauge charts require exactly one one-value series')
    }
  } else if (kind === 'box' || kind === 'dot') {
    if (series.length === 0) throw new Error(`${kind} charts require at least one series`)
  } else {
    if (series.length === 0) {
      throw new Error('Chart must define at least one series')
    }
    if (seriesLengths.size > 1) {
      throw new Error('All chart series must have the same number of values')
    }
    const usesPoints = series.some(entry => entry.points && entry.points.length > 0)
    if (usesPoints) {
      if (kind !== 'combo') {
        throw new Error('Point series are only supported for scatter, dot, and combo charts')
      }
      if (series.some(entry => entry.type !== 'scatter' && entry.points && entry.points.length > 0)) {
        throw new Error('Combo point series must declare type=scatter')
      }
    }
    const valueCount = series[0]?.values?.length ?? 0
    if (categories && chartHasCategoricalSeries && categories.length !== valueCount) {
      throw new Error('Chart categories must match the series value count')
    }
    if ((xMin != null || xMax != null) && kind !== 'combo') {
      throw new Error('Chart xmin/xmax are only supported for scatter, dot, and combo scatter charts')
    }
    if (stack != null && kind !== 'bar' && kind !== 'area' && kind !== 'combo') {
      throw new Error('Chart stack mode is only supported for bar, area, and combo charts')
    }
    if (kind === 'waterfall' && series.length !== 1) {
      throw new Error('Waterfall charts require exactly one series')
    }
    if (kind === 'funnel' && series.length !== 1) {
      throw new Error('Funnel charts require exactly one series')
    }
    if (kind === 'tornado' && series.length !== 2) {
      throw new Error('Tornado charts require exactly two series')
    }
    if (kind === 'radar' || kind === 'radial-bar' || kind === 'funnel' || kind === 'waterfall' || kind === 'likert' || kind === 'tornado') {
      if (!categories || categories.length === 0) {
        throw new Error(`${kind} charts require categories`)
      }
    }
    if (kind === 'combo' && series.every(entry => !entry.type)) {
      series[0]!.type = 'bar'
      for (let i = 1; i < series.length; i++) {
        series[i]!.type = 'line'
      }
    }
    if (kind === 'likert') {
      stack = 'percent'
    }
    if (kind === 'radar' || kind === 'radial-bar') {
      points = 'show'
    }
  }

  if (kind === 'combo') {
    const hasRightAxisSeries = series.some(entry => entry.axis === 'right')
    if (hasRightAxisSeries && y2Min != null && y2Max != null && y2Min >= y2Max) {
      throw new Error('Chart y2min must be less than y2max')
    }
  }
  if (kind === 'dot' && xMin != null && xMax != null && xMin >= xMax) {
    throw new Error('Chart xmin must be less than xmax')
  }
  if (kind === 'scatter' || kind === 'combo') {
    if (xMin != null && xMax != null && xMin >= xMax) {
      throw new Error('Chart xmin must be less than xmax')
    }
  }
  if (kind !== 'scatter' && kind !== 'dot' && kind !== 'combo' && (xMin != null || xMax != null)) {
    throw new Error('Chart xmin/xmax are only supported on numeric x charts')
  }
  if (kind !== 'donut' && kind !== 'pie' && innerRadius != null) {
    throw new Error('Chart inner is only supported for pie/donut charts')
  } else {
    innerRadius = kind === 'donut' ? (innerRadius ?? 0.56) : undefined
  }
  if (yMin != null && yMax != null && yMin >= yMax) {
    throw new Error('Chart ymin must be less than ymax')
  }
  if (y2Min != null && y2Max != null && y2Min >= y2Max) {
    throw new Error('Chart y2min must be less than y2max')
  }

  const chart: ScrawlChart = {
    kind,
    title,
    xLabel,
    yLabel,
    categories,
    legend,
    grid,
    points,
    stack,
    curve,
    labels,
    xTickCount,
    yTickCount,
    y2TickCount,
    xMin,
    xMax,
    yMin,
    yMax,
    y2Min,
    y2Max,
    innerRadius,
    target,
    thresholds,
    references,
    annotations,
    flows,
    cells,
    items,
    series,
  }

  return {
    meta: { dir: 'lr', theme, kind: 'chart', style },
    nodes: [],
    edges: [],
    groups: [],
    chart,
  }
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseDiagram(source: string): ScrawlDiagram {
  const defaultDiagram: ScrawlDiagram = {
    meta: { dir: 'lr', theme: 'rough', kind: 'graph' },
    nodes: [],
    edges: [],
    groups: [],
  }

  const firstMeaningfulLine = source
    .split('\n')
    .map(line => {
      const hashIdx = line.indexOf('#')
      return hashIdx === -1 ? line : line.slice(0, hashIdx)
    })
    .find(line => line.trim().length > 0)

  if (firstMeaningfulLine?.trim() === 'wireframe') {
    return parseWireframe(source)
  }
  if (firstMeaningfulLine?.trim().startsWith('sequence')) {
    return parseSequence(source)
  }
  if (firstMeaningfulLine?.trim() === 'chart') {
    return parseChart(source)
  }

  // Strip comments and get non-empty lines
  const rawLines = source.split('\n')
  const lines = rawLines.map(l => {
    const hashIdx = l.indexOf('#')
    return hashIdx === -1 ? l : l.slice(0, hashIdx)
  }).map(l => l.trim())

  const nonEmpty = lines.filter(l => l.length > 0)
  if (nonEmpty.length === 0) return defaultDiagram

  // Determine direction from first non-empty line
  let dir: Direction = 'lr'
  let startIdx = 0

  const firstLine = nonEmpty[0]
  if ((DIRECTIONS as readonly string[]).includes(firstLine)) {
    dir = firstLine as Direction
    startIdx = 1
  }

  // Collect group lines and edge/node lines
  const nodeMap = new Map<string, NodeAttrs>()
  // Track explicit definition order
  const definitionOrder: string[] = []
  const edges: ScrawlEdge[] = []
  const rawGroups: ScrawlGroup[] = []
  const groupIds = new Set<string>()

  for (let i = startIdx; i < nonEmpty.length; i++) {
    const line = nonEmpty[i]

    if (line.startsWith('[')) {
      // Group line
      const group = parseGroupLine(line)
      if (groupIds.has(group.id)) {
        throw new Error(`Duplicate group id: "${group.id}"`)
      }
      groupIds.add(group.id)
      rawGroups.push(group)
    } else if (isStandaloneNodeLine(line)) {
      // Standalone node declaration
      const attrs = parseNodeExpr(line)
      if (nodeMap.has(attrs.id)) {
        // Re-declaration with possibly different attrs: check if truly different
        const existing = nodeMap.get(attrs.id)!
        const isDiff =
          existing.shape !== attrs.shape ||
          existing.label !== attrs.label ||
          existing.color !== attrs.color
        if (isDiff) {
          throw new Error(`Duplicate node id: "${attrs.id}"`)
        }
        // Same definition — silently ignore
      } else {
        nodeMap.set(attrs.id, attrs)
        definitionOrder.push(attrs.id)
      }
    } else {
      // Edge line — may implicitly define nodes
      const beforeSize = nodeMap.size
      parseEdgeLine(line, nodeMap, edges)
      // Track new nodes added by this edge line
      if (nodeMap.size > beforeSize) {
        for (const [id] of nodeMap) {
          if (!definitionOrder.includes(id)) {
            definitionOrder.push(id)
          }
        }
      }
    }
  }

  // Validate group node refs
  for (const group of rawGroups) {
    for (const nid of group.nodeIds) {
      if (!nodeMap.has(nid)) {
        throw new Error(`Group "${group.id}" references unknown node id: "${nid}"`)
      }
    }
  }

  // Build groupId lookup
  const nodeGroupMap = new Map<string, string>()
  for (const group of rawGroups) {
    for (const nid of group.nodeIds) {
      nodeGroupMap.set(nid, group.id)
    }
  }

  // Build ordered nodes list (definition order)
  const nodes: ScrawlNode[] = definitionOrder.map(id => {
    const attrs = nodeMap.get(id)!
    const node: ScrawlNode = {
      id: attrs.id,
      label: attrs.label,
      shape: attrs.shape,
    }
    if (attrs.color !== undefined) node.color = attrs.color
    const gid = nodeGroupMap.get(id)
    if (gid !== undefined) node.groupId = gid
    return node
  })

  return {
    meta: { dir, theme: 'rough', kind: 'graph' },
    nodes,
    edges,
    groups: rawGroups,
  }
}
