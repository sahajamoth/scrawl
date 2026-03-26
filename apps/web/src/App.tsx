import { useState, useCallback } from 'react'
import { Editor } from './components/Editor.js'
import { Preview } from './components/Preview.js'
import { Toolbar } from './components/Toolbar.js'
import { useDiagram } from './hooks/useDiagram.js'
import { useUrlState } from './hooks/useUrlState.js'
import { EXAMPLES } from './examples/index.js'

export function App() {
  const [content, setContent] = useUrlState()
  const [theme, setTheme] = useState<'rough' | 'clean'>('rough')
  const [copied, setCopied] = useState(false)
  const { svg, error, rendering } = useDiagram(content, { theme })

  const handleCopy = useCallback(async () => {
    if (!svg) return
    try {
      await navigator.clipboard.writeText(svg)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // fallback: create textarea
      const ta = document.createElement('textarea')
      ta.value = svg
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [svg])

  const handleDownload = useCallback(() => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [svg])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <Toolbar
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'rough' ? 'clean' : 'rough')}
        onExampleSelect={setContent}
        onCopySvg={handleCopy}
        onDownloadSvg={handleDownload}
        examples={EXAMPLES}
        copied={copied}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, borderRight: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <Editor value={content} onChange={setContent} />
        </div>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Preview svg={svg} error={error} rendering={rendering} />
        </div>
      </div>
    </div>
  )
}
