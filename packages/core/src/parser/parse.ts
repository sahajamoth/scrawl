import { parse as parseToml } from 'smol-toml'
import { diagramSchema } from './schema.js'
import type { ScrawlDiagram } from '../ir/types.js'

export function parseDiagram(source: string): ScrawlDiagram {
  let raw: unknown
  try {
    raw = parseToml(source)
  } catch (err) {
    throw new Error(`TOML parse error: ${err instanceof Error ? err.message : String(err)}`)
  }
  const result = diagramSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Scrawl validation error:\n${issues}`)
  }
  return result.data
}
