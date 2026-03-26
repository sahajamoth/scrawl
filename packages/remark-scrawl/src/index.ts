import { visit } from 'unist-util-visit'
import { renderDiagram } from '@scrawl/core'
import type { Plugin } from 'unified'
import type { Root, Code, Html } from 'mdast'

export interface RemarkScrawlOptions {
  /**
   * How to embed the SVG.
   * - 'inline': embed SVG directly in HTML (default)
   * - 'img': use <img src="data:image/svg+xml;base64,...">
   */
  mode?: 'inline' | 'img'
  /**
   * Override the diagram theme ('rough' | 'clean')
   */
  theme?: 'rough' | 'clean'
  /**
   * CSS class added to the wrapper <div> (inline mode) or <img> (img mode)
   */
  className?: string
}

const remarkScrawl: Plugin<[RemarkScrawlOptions?], Root> = (options = {}) => {
  const { mode = 'inline', theme, className = 'scrawl-diagram' } = options

  return async (tree: Root) => {
    // Collect all scrawl code nodes
    const nodes: Array<{ node: Code; index: number; parent: Root['children'][number] }> = []

    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang === 'scrawl' && typeof index === 'number' && parent) {
        nodes.push({ node, index, parent: parent as Root['children'][number] })
      }
    })

    if (nodes.length === 0) return

    // Render all diagrams in parallel
    await Promise.all(
      nodes.map(async ({ node, index, parent }) => {
        try {
          const svg = renderDiagram(node.value, theme ? { theme } : undefined)

          let html: string
          if (mode === 'img') {
            const b64 = Buffer.from(svg).toString('base64')
            const alt = extractTitle(node.value)
            html = `<img src="data:image/svg+xml;base64,${b64}" alt="${escapeAttr(alt)}" class="${escapeAttr(className)}" />`
          } else {
            html = `<div class="${escapeAttr(className)}">${svg}</div>`
          }

          const htmlNode: Html = { type: 'html', value: html }
          // Replace code node with html node in parent
          const parentEl = parent as unknown as { children: unknown[] }
          parentEl.children[index] = htmlNode
        } catch (err) {
          // On error, wrap in error div so the document still renders
          const msg = err instanceof Error ? err.message : String(err)
          const htmlNode: Html = {
            type: 'html',
            value: `<div class="${escapeAttr(className)} scrawl-error" style="color:red;border:1px solid red;padding:8px;font-family:monospace">scrawl error: ${escapeHtml(msg)}</div>`,
          }
          const parentEl = parent as unknown as { children: unknown[] }
          parentEl.children[index] = htmlNode
        }
      }),
    )
  }
}

function extractTitle(source: string): string {
  const match = source.match(/title\s*=\s*["']([^"']+)["']/)
  return match?.[1] ?? 'scrawl diagram'
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default remarkScrawl
