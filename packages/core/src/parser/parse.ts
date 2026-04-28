import type {
  ScrawlDiagram,
  ScrawlNode,
  ScrawlEdge,
  ScrawlGroup,
  ScrawlComponent,
  DiagramMeta,
  Direction,
  ShapeType,
  EdgeStyle,
  ArrowType,
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
  const label = colonIdx === -1 ? remainder : remainder.slice(colonIdx + 1).trim() || remainder.slice(0, colonIdx).trim()
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

function parseSequenceNoteLine(line: string, index: number): SequenceNote {
  const match = line.match(/^note\s+(left|right)\s+of\s+([\w-]+)\s*:\s*(.+)$/)
    ?? line.match(/^note\s+(over)\s+([\w-]+)\s*:\s*(.+)$/)
  if (!match) {
    throw new Error(`Invalid sequence note syntax on line ${index + 1}`)
  }

  return {
    placement: match[1] as SequenceNote['placement'],
    target: match[2]!,
    label: match[3]!.trim(),
  }
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

      if (pendingBreak) {
        sequenceBreaks.push(definitionOrder.length)
        pendingBreak = false
      }
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
    if (pendingBreak && nodeMap.size > beforeSize) {
      sequenceBreaks.push(definitionOrder.length)
      pendingBreak = false
    }
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
