import { describe, expect, it } from 'vitest'
import {
  computeRenderCrop,
  createAdaptiveQuality,
  effectivePixelRatio,
  QUALITY_TIER_ORDER,
  QUALITY_TIERS,
  selectInitialTier,
} from './renderQuality'

describe('selectInitialTier', () => {
  it('starts phones on a light tier and low-end phone GPUs on the lightest', () => {
    expect(selectInitialTier({ devicePixelRatio: 3, isMobile: true, gpuRenderer: 'Apple GPU' })).toBe('medium')
    expect(selectInitialTier({ devicePixelRatio: 2, isMobile: true, gpuRenderer: 'Mali-T880' })).toBe('low')
  })

  it('starts discrete desktop GPUs on ultra and integrated laptop GPUs on high', () => {
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 4070)' })).toBe('ultra')
    expect(selectInitialTier({
      devicePixelRatio: 2,
      isMobile: false,
      gpuRenderer: 'ANGLE (Intel, Intel(R) Graphics (0x00007D41) Direct3D11)',
    })).toBe('high')
  })

  it('falls back to low for software renderers and honours a valid override', () => {
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, gpuRenderer: 'Google SwiftShader' })).toBe('low')
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, override: 'medium' })).toBe('medium')
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, override: 'bogus' })).toBe('high')
  })

  it('treats old integrated GPUs and 2-core machines as medium', () => {
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, gpuRenderer: 'Intel(R) HD Graphics 520' })).toBe('medium')
    expect(selectInitialTier({ devicePixelRatio: 1, isMobile: false, hardwareConcurrency: 2 })).toBe('medium')
  })
})

describe('quality tiers', () => {
  it('are ordered from most to least expensive', () => {
    const ratios = QUALITY_TIER_ORDER.map((id) => QUALITY_TIERS[id].pixelRatioCap)
    expect([...ratios].sort((a, b) => b - a)).toEqual(ratios)
    // Every tier keeps MSAA so hair alpha-to-coverage still works.
    QUALITY_TIER_ORDER.forEach((id) => expect(QUALITY_TIERS[id].msaaSamples).toBeGreaterThanOrEqual(2))
  })

  it('caps the pixel ratio per tier and guards against bad device ratios', () => {
    expect(effectivePixelRatio(QUALITY_TIERS.high, 2)).toBe(1.5)
    expect(effectivePixelRatio(QUALITY_TIERS.ultra, 1.25)).toBe(1.25)
    expect(effectivePixelRatio(QUALITY_TIERS.low, Number.NaN)).toBe(1)
  })
})

// Drives the controller with a constant frame interval / GPU time from `from` to `to` ms.
function run(
  controller: ReturnType<typeof createAdaptiveQuality>,
  from: number,
  to: number,
  intervalMs: number,
  gpuMs: number | null = null,
  budgetMs = 1000 / 60,
) {
  const changes: string[] = []
  for (let now = from; now <= to; now += intervalMs) {
    const next = controller.sample(intervalMs, now, budgetMs, gpuMs)
    if (next) changes.push(next)
  }
  return changes
}

describe('createAdaptiveQuality', () => {
  it('ignores the warm-up window and absurd gaps', () => {
    const controller = createAdaptiveQuality('high', 0)
    expect(run(controller, 0, 2000, 40)).toEqual([])
    expect(controller.sample(5000, 3000, 16.7)).toBeNull()
    expect(controller.tier).toBe('high')
  })

  it('steps down one tier at a time when frames stay over budget', () => {
    const controller = createAdaptiveQuality('ultra', 0)
    const changes = run(controller, 0, 12000, 30)
    expect(changes[0]).toBe('high')
    expect(changes).toEqual(QUALITY_TIER_ORDER.slice(1, changes.length + 1))
    expect(controller.tier).toBe('low')
  })

  it('steps down on GPU time even when vsync hides the cost in the frame interval', () => {
    const controller = createAdaptiveQuality('ultra', 0)
    expect(run(controller, 0, 5000, 16.7, 15)).toEqual(['high'])
  })

  it('does not blame the avatar for slow frames when its GPU share is small', () => {
    const controller = createAdaptiveQuality('high', 0)
    expect(run(controller, 0, 20000, 33, 4)).toEqual([])
    expect(controller.tier).toBe('high')
  })

  it('upgrades only with measured GPU headroom, backing off after a failed attempt', () => {
    const controller = createAdaptiveQuality('medium', 0)
    // Plenty of headroom: 4 ms GPU at 60 fps.
    const upgrades = run(controller, 0, 9000, 16.7, 4)
    expect(upgrades).toEqual(['high'])

    // The higher tier turns out too expensive: back down...
    expect(run(controller, 9000, 13000, 16.7, 15)).toEqual(['medium'])

    // ...and the next attempt waits twice as long as the first.
    const firstRetry = run(controller, 13000, 19000, 16.7, 4)
    expect(firstRetry).toEqual([])
    expect(run(controller, 19000, 26000, 16.7, 4)).toEqual(['high'])
  })

  it('never upgrades past the ceiling', () => {
    const controller = createAdaptiveQuality('high', 0, { ceiling: 'high' })
    expect(run(controller, 0, 60000, 16.7, 2)).toEqual([])
  })

  it('without GPU timing, only tries rare speculative upgrades', () => {
    const controller = createAdaptiveQuality('medium', 0)
    expect(run(controller, 0, 15000, 16.7)).toEqual([])
    expect(run(controller, 15000, 25000, 16.7)).toEqual(['high'])
  })
})

describe('computeRenderCrop', () => {
  it('renders a centred window at most `maxAspect` canvas heights wide', () => {
    expect(computeRenderCrop(2045, 680, 1.6)).toEqual({ x: 479, width: 1088 })
  })

  it('uses the full width when the container is already narrow', () => {
    expect(computeRenderCrop(400, 300, 1.6)).toEqual({ x: 0, width: 400 })
  })
})
