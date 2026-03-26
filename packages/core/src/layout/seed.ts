// djb2 variant: deterministic 32-bit hash for content-based seeding.
// Avoids async WASM init (xxhash-wasm) while preserving full determinism.
export function computeSeed(source: string): number {
  let hash = 5381
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) + hash) ^ source.charCodeAt(i)
    hash = hash >>> 0 // keep as 32-bit unsigned
  }
  return hash === 0 ? 1 : hash // rough.js treats seed=0 as random
}
