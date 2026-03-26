interface PreviewProps {
  svg: string | null
  error: string | null
  rendering: boolean
}

export function Preview({ svg, error, rendering }: PreviewProps) {
  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#fafafa' }}>
      {rendering && (
        <div style={{ position: 'absolute', top: 8, right: 12, fontSize: 12, color: '#999' }}>rendering…</div>
      )}
      {error && (
        <div style={{ color: '#e53e3e', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, maxWidth: '100%', wordBreak: 'break-word' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {svg && !error && (
        <div dangerouslySetInnerHTML={{ __html: svg }} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      )}
      {!svg && !error && !rendering && (
        <div style={{ color: '#a0aec0', fontSize: 14 }}>Start typing a diagram…</div>
      )}
    </div>
  )
}
