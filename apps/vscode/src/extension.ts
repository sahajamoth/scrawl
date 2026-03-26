import * as vscode from 'vscode'
import { ScrawlPreviewPanel } from './preview/ScrawlPreviewPanel.js'
import { ScrawlHoverProvider } from './providers/ScrawlHoverProvider.js'

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('scrawl.openPreview', () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('Open a .scrawl file first')
      return
    }
    ScrawlPreviewPanel.createOrShow(context.extensionUri, editor.document)
  })
  context.subscriptions.push(disposable)

  // Auto-open preview when a .scrawl file becomes the active editor
  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document.languageId === 'scrawl') {
      ScrawlPreviewPanel.update(editor.document)
    }
  })
  context.subscriptions.push(editorChangeDisposable)

  // Update preview on document save
  const saveDisposable = vscode.workspace.onDidSaveTextDocument(document => {
    if (document.languageId === 'scrawl') {
      ScrawlPreviewPanel.update(document)
    }
  })
  context.subscriptions.push(saveDisposable)

  // Also update on text changes (live update)
  const changeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'scrawl') {
      ScrawlPreviewPanel.update(event.document)
    }
  })
  context.subscriptions.push(changeDisposable)

  // Hover provider: show node/edge counts
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'scrawl' },
    new ScrawlHoverProvider(),
  )
  context.subscriptions.push(hoverDisposable)
}

export function deactivate(): void {
  ScrawlPreviewPanel.dispose()
}
