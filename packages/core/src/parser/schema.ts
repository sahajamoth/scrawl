import { z } from 'zod'
import type { ScrawlDiagram } from '../ir/types.js'

const directionSchema = z.enum(['lr', 'td', 'rl', 'dt', 'radial']).default('td')
const themeSchema = z.enum(['rough', 'clean']).default('rough')
const shapeSchema = z.enum(['b', 'r', 'c', 'd', 'y', 'p', 'h']).default('b')
const edgeStyleSchema = z.enum(['solid', 'dashed', 'dotted']).default('solid')
const arrowSchema = z.enum(['arrow', 'none', 'both']).default('arrow')

const metaSchema = z.object({
  title: z.string().optional(),
  dir: directionSchema,
  theme: themeSchema,
})

const nodeRawSchema = z.object({
  id: z.string().min(1).regex(/^[\w-]+$/, 'id must be alphanumeric, underscore, or hyphen'),
  l: z.string().min(1),
  s: shapeSchema,
  c: z.string().optional(),
})

const edgeRawSchema = z.object({
  f: z.string().min(1),
  t: z.string().min(1),
  l: z.string().optional(),
  st: edgeStyleSchema,
  a: arrowSchema,
})

const groupRawSchema = z.object({
  id: z.string().min(1),
  l: z.string().optional(),
  nodes: z.array(z.string()).min(1),
})

// The raw TOML structure
const rawSchema = z.object({
  d: metaSchema.optional().default({}),
  n: z.array(nodeRawSchema).optional().default([]),
  e: z.array(edgeRawSchema).optional().default([]),
  g: z.array(groupRawSchema).optional().default([]),
})

// Transform to ScrawlDiagram shape
export const diagramSchema = rawSchema.transform((raw): ScrawlDiagram => {
  const nodeIds = new Set(raw.n.map(n => n.id))

  // Validate duplicate node ids
  if (nodeIds.size !== raw.n.length) {
    const seen = new Set<string>()
    for (const node of raw.n) {
      if (seen.has(node.id)) throw new Error(`Duplicate node id: "${node.id}"`)
      seen.add(node.id)
    }
  }

  // Validate edge refs
  for (const edge of raw.e) {
    if (!nodeIds.has(edge.f)) throw new Error(`Edge references unknown node id: "${edge.f}"`)
    if (!nodeIds.has(edge.t)) throw new Error(`Edge references unknown node id: "${edge.t}"`)
  }

  // Validate group refs
  const groupIds = new Set<string>()
  for (const group of raw.g) {
    if (groupIds.has(group.id)) throw new Error(`Duplicate group id: "${group.id}"`)
    groupIds.add(group.id)
    for (const nid of group.nodes) {
      if (!nodeIds.has(nid)) throw new Error(`Group "${group.id}" references unknown node id: "${nid}"`)
    }
  }

  // Build groupId lookup
  const nodeGroupMap = new Map<string, string>()
  for (const group of raw.g) {
    for (const nid of group.nodes) nodeGroupMap.set(nid, group.id)
  }

  return {
    meta: raw.d,
    nodes: raw.n.map(n => ({
      id: n.id,
      label: n.l,
      shape: n.s,
      color: n.c,
      groupId: nodeGroupMap.get(n.id),
    })),
    edges: raw.e.map(e => ({
      from: e.f,
      to: e.t,
      label: e.l,
      style: e.st,
      arrow: e.a,
    })),
    groups: raw.g.map(g => ({
      id: g.id,
      label: g.l,
      nodeIds: g.nodes,
    })),
  }
})
