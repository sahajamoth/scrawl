import { parseDiagram } from './parser/parse.js'
import { layoutDiagram } from './layout/layout.js'
import { renderToSvg } from './renderer/renderer.js'

export type {
  ScrawlDiagram,
  LayoutResult,
  DiagramMeta,
  ScrawlNode,
  ScrawlEdge,
  ScrawlGroup,
  LayoutNode,
  LayoutEdge,
  LayoutGroup,
} from './ir/types.js'

export { parseDiagram } from './parser/parse.js'
export { layoutDiagram } from './layout/layout.js'
export { renderToSvg } from './renderer/renderer.js'

export interface RenderOptions {
  theme?: 'rough' | 'clean'
}

export function renderDiagram(source: string, options?: RenderOptions): string {
  const diagram = parseDiagram(source)
  if (options?.theme) diagram.meta.theme = options.theme
  const layout = layoutDiagram(diagram, source)
  return renderToSvg(layout)
}
