import { useState, useEffect, useCallback } from 'react'
import LZString from 'lz-string'
import { EXAMPLES } from '../examples/index.js'

export function useUrlState(): [string, (value: string) => void] {
  const [content, setContent] = useState<string>(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      try {
        const decoded = LZString.decompressFromEncodedURIComponent(hash)
        if (decoded) return decoded
      } catch {
        // ignore decode errors
      }
    }
    return EXAMPLES[0]!.content
  })

  useEffect(() => {
    const compressed = LZString.compressToEncodedURIComponent(content)
    window.history.replaceState(null, '', `#${compressed}`)
  }, [content])

  const update = useCallback((value: string) => {
    setContent(value)
  }, [])

  return [content, update]
}
