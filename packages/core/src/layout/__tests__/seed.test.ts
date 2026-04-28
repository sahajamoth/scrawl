import { describe, expect, it } from 'vitest'
import { computeSeed, deriveSeed, seededRandom } from '../seed.js'

describe('seed helpers', () => {
  it('computeSeed is deterministic and never returns zero', () => {
    expect(computeSeed('alpha -> beta')).toBe(computeSeed('alpha -> beta'))
    expect(computeSeed('')).not.toBe(0)
  })

  it('deriveSeed is deterministic per base seed and element id', () => {
    expect(deriveSeed(12345, 'node:a')).toBe(deriveSeed(12345, 'node:a'))
    expect(deriveSeed(12345, 'node:a')).not.toBe(deriveSeed(12345, 'node:b'))
    expect(deriveSeed(0, 'node:a')).not.toBe(0)
  })

  it('seededRandom is deterministic for the same seed/index pair', () => {
    expect(seededRandom(42, 0)).toBe(seededRandom(42, 0))
    expect(seededRandom(42, 1)).not.toBe(seededRandom(42, 0))
  })
})
