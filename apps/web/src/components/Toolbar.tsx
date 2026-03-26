interface ToolbarProps {
  theme: 'rough' | 'clean'
  onThemeToggle: () => void
  onExampleSelect: (content: string) => void
  onCopySvg: () => void
  onDownloadSvg: () => void
  examples: Array<{ name: string; content: string }>
  copied: boolean
}

export function Toolbar({ theme, onThemeToggle, onExampleSelect, onCopySvg, onDownloadSvg, examples, copied }: ToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18, marginRight: 8 }}>✏️ scrawl</span>

      <select
        onChange={e => {
          const ex = examples.find(ex => ex.name === e.target.value)
          if (ex) onExampleSelect(ex.content)
        }}
        defaultValue=""
        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e0', fontSize: 13 }}
      >
        <option value="" disabled>Examples…</option>
        {examples.map(ex => (
          <option key={ex.name} value={ex.name}>{ex.name}</option>
        ))}
      </select>

      <button
        onClick={onThemeToggle}
        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer', fontSize: 13 }}
      >
        Theme: {theme}
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          onClick={onCopySvg}
          style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e0', background: copied ? '#c6f6d5' : '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          {copied ? '✓ Copied' : 'Copy SVG'}
        </button>
        <button
          onClick={onDownloadSvg}
          style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #cbd5e0', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          Download SVG
        </button>
      </div>
    </div>
  )
}
