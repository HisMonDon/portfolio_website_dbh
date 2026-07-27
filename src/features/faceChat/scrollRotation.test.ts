import { describe, expect, it } from 'vitest'
import { computeRotationDelta } from './scrollRotation'

describe('computeRotationDelta', () => {
  const viewportHeight = 800

  it('returns a positive, proportional rotation for a small forward (downward) delta', () => {
    const delta = computeRotationDelta(0, 100, viewportHeight)

    expect(delta).toBeCloseTo((2 * Math.PI * 100) / viewportHeight)
    expect(delta).toBeGreaterThan(0)
  })

  it('returns a negative, proportional rotation for a small backward (upward) delta', () => {
    const delta = computeRotationDelta(100, 0, viewportHeight)

    expect(delta).toBeCloseTo((2 * Math.PI * -100) / viewportHeight)
    expect(delta).toBeLessThan(0)
  })

  it('returns exactly one full turn for a delta equal to the viewport height', () => {
    const delta = computeRotationDelta(0, viewportHeight * 0.4, viewportHeight)

    expect(delta).toBeCloseTo(2 * Math.PI * 0.4)
  })

  it('returns 0 for a zero delta', () => {
    expect(computeRotationDelta(200, 200, viewportHeight)).toBe(0)
  })

  it('rejects a delta at or above the maxJumpFraction threshold (simulated scroll-anchoring reset)', () => {
    const delta = computeRotationDelta(500, 500 - viewportHeight, viewportHeight)

    expect(delta).toBe(0)
  })

  it('still applies a delta just under the maxJumpFraction threshold', () => {
    const justUnder = viewportHeight * 0.5 - 1
    const delta = computeRotationDelta(0, justUnder, viewportHeight)

    expect(delta).toBeCloseTo((2 * Math.PI * justUnder) / viewportHeight)
    expect(delta).not.toBe(0)
  })

  it('respects a custom maxJumpFraction argument', () => {
    const smallDelta = viewportHeight * 0.2

    expect(computeRotationDelta(0, smallDelta, viewportHeight, 0.5)).not.toBe(0)
    expect(computeRotationDelta(0, smallDelta, viewportHeight, 0.1)).toBe(0)
  })

  it('returns 0 when viewportHeight is not positive', () => {
    expect(computeRotationDelta(0, 100, 0)).toBe(0)
  })
})
