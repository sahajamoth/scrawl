import * as vscode from 'vscode'
import { parseDiagram } from 'scrawl-core'

export class ScrawlHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    _position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Hover> {
    try {
      const diagram = parseDiagram(document.getText())
      const nodeCount = diagram.nodes.length
      const edgeCount = diagram.edges.length
      const groupCount = diagram.groups.length

      const lines = [
        `**Scrawl Diagram**`,
        '',
        `- Nodes: ${nodeCount}`,
        `- Edges: ${edgeCount}`,
        ...(groupCount > 0 ? [`- Groups: ${groupCount}`] : []),
      ]

      return new vscode.Hover(new vscode.MarkdownString(lines.join('\n')))
    } catch {
      return undefined
    }
  }
}
