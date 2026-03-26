import { useState, useEffect, useRef } from 'react'
import { renderDiagram, type RenderOptions } from '@scrawl/core'

export interface DiagramState {
  svg: string | null
  error: string | null
  rendering: boolean
}

export function useDiagram(source: string, options?: RenderOptions): DiagramState {
  const [state, setState] = useState<DiagramState>({ svg: null, error: null, rendering: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!source.trim()) {
      setState({ svg: null, error: null, rendering: false })
      return
    }

    setState(s => ({ ...s, rendering: true }))
    timerRef.current = setTimeout(() => {
      try {
        const svg = renderDiagram(source, options)
        setState({ svg, error: null, rendering: false })
      } catch (err) {
        setState({ svg: null, error: err instanceof Error ? err.message : String(err), rendering: false })
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [source, options?.theme])

  return state
}
