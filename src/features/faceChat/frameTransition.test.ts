import { describe, expect, it } from 'vitest'
import { easeClipTransition, interpolateInternalFrames } from './frameTransition'
import type { InternalFrame } from './clipFormat'

describe('cross-clip frame interpolation', () => {
  const from: InternalFrame = {
    t: 1000,
    categories: [
      { categoryName: 'jawOpen', score: 0 },
      { categoryName: 'mouthSmileLeft', score: 0.2 },
    ],
    pose: {
      bones: { head: [0, 0, 0, 1] },
      rootPosition: [0, 0, 0],
    },
  }
  const to: InternalFrame = {
    t: 50,
    categories: [
      { categoryName: 'jawOpen', score: 1 },
      { categoryName: 'eyeBlinkLeft', score: 0.4 },
    ],
    pose: {
      bones: { head: [0, 1, 0, 0] },
      rootPosition: [1, 2, 3],
    },
  }

  it('clamps and smooths transition progress', () => {
    expect(easeClipTransition(-1)).toBe(0)
    expect(easeClipTransition(0.5)).toBe(0.5)
    expect(easeClipTransition(2)).toBe(1)
  })

  it('smoothly blends facial scores and retains categories present in only one frame', () => {
    const halfway = interpolateInternalFrames(from, to, 0.5)

    expect(halfway.categories).toEqual([
      { categoryName: 'jawOpen', score: 0.5 },
      { categoryName: 'eyeBlinkLeft', score: 0.2 },
      { categoryName: 'mouthSmileLeft', score: 0.1 },
    ])
  })

  it('lerps root movement and slerps bone rotation', () => {
    const halfway = interpolateInternalFrames(from, to, 0.5)
    const head = halfway.pose?.bones.head

    expect(halfway.pose?.rootPosition).toEqual([0.5, 1, 1.5])
    expect(head?.[0]).toBeCloseTo(0)
    expect(Math.abs(head?.[1] ?? 0)).toBeCloseTo(Math.SQRT1_2)
    expect(head?.[2]).toBeCloseTo(0)
    expect(Math.abs(head?.[3] ?? 0)).toBeCloseTo(Math.SQRT1_2)
  })

  it('returns the exact boundary frames at the start and end', () => {
    expect(interpolateInternalFrames(from, to, 0)).toBe(from)
    expect(interpolateInternalFrames(from, to, 1)).toBe(to)
  })
})
