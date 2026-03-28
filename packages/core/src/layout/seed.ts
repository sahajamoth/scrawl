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

/** Derive a per-element seed from the global diagram seed and element id. */
export function deriveSeed(baseSeed: number, id: string): number {
  let hash = baseSeed
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) + hash) ^ id.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash === 0 ? 1 : hash
}

/** Seeded pseudo-random number in [0, 1) from a seed. Deterministic. */
export function seededRandom(seed: number, index = 0): number {
  const s = ((seed + index * 49979693) * 48271) & 0x7fffffff
  return (s & 0xffff) / 0x10000
}
