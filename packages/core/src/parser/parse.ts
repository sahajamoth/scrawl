import type {
  ScrawlDiagram,
  ScrawlNode,
  ScrawlEdge,
  ScrawlGroup,
  ScrawlComponent,
  Direction,
  ShapeType,
  EdgeStyle,
  ArrowType,
  WireframeKind,
} from '../ir/types.js'
import { DIRECTIONS } from './schema.js'

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
  for (let i = 0; i + 2 < parts.length; i += 2) {
    const fromExpr = parts[i].trim()
    const arrowToken = parts[i + 1].trim()
    const toRaw = parts[i + 2].trim()

    const arrowAttrs = parseArrow(arrowToken)
    const fromAttrs = parseNodeExpr(fromExpr)
    registerNode(fromAttrs, nodeMap)

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
      from: fromAttrs.id,
      to: toAttrs.id,
      label: edgeLabel,
      style: arrowAttrs.style,
      arrow: arrowAttrs.arrow,
    })
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
])

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
  return {
    id,
    kind,
    label,
    width: size.width,
    height: size.height,
  }
}

function parseWireframe(source: string): ScrawlDiagram {
  const lines = source.split('\n').map(line => {
    const hashIdx = line.indexOf('#')
    return hashIdx === -1 ? line : line.slice(0, hashIdx)
  })

  const components: ScrawlComponent[] = []
  const autoIds = new Map<string, number>()
  const stack: Array<{ indent: number; id: string }> = []
  const ids = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!
    if (!raw.trim()) continue
    if (raw.trim() === 'wireframe') continue

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
    }
  }

  return {
    meta: { dir: 'lr', theme: 'rough', kind: 'wireframe', style: 'sketch' },
    nodes: [],
    edges: [],
    groups: [],
    components,
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
