import * as vscode from 'vscode'
import { renderDiagram, parseDiagram } from '@scrawl/core'

export class ScrawlPreviewPanel {
  private static instance: ScrawlPreviewPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private disposables: vscode.Disposable[] = []

  private constructor(extensionUri: vscode.Uri, document: vscode.TextDocument) {
    this.panel = vscode.window.createWebviewPanel(
      'scrawlPreview',
      'Scrawl Preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: false,
        localResourceRoots: [extensionUri],
      },
    )
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this.render(document.getText())
  }

  static createOrShow(extensionUri: vscode.Uri, document: vscode.TextDocument): void {
    if (ScrawlPreviewPanel.instance) {
      ScrawlPreviewPanel.instance.panel.reveal(vscode.ViewColumn.Beside, true)
      ScrawlPreviewPanel.instance.render(document.getText())
      return
    }
    ScrawlPreviewPanel.instance = new ScrawlPreviewPanel(extensionUri, document)
  }

  static update(document: vscode.TextDocument): void {
    ScrawlPreviewPanel.instance?.render(document.getText())
  }

  static dispose(): void {
    ScrawlPreviewPanel.instance?.dispose()
  }

  private render(source: string): void {
    this.panel.webview.html = this.buildHtml(source)
  }

  private buildHtml(source: string): string {
    let body: string
    try {
      const svg = renderDiagram(source)
      body = `<div style="padding:16px;background:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;">${svg}</div>`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      body = `<div style="padding:16px;color:#e53e3e;font-family:monospace;font-size:13px;background:#fff5f5;min-height:100vh"><pre style="white-space:pre-wrap;word-break:break-word">Error:\n${escapeHtml(msg)}</pre></div>`
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; script-src 'none';">
  <title>Scrawl Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: #fafafa; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>${body}</body>
</html>`
  }

  private dispose(): void {
    ScrawlPreviewPanel.instance = undefined
    this.panel.dispose()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
