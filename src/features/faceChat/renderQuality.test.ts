import { describe, expect, it } from 'vitest'
import {
  computeRenderCrop,
  createAdaptiveQuality,
  createRenderCropPlanner,
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

describe('createRenderCropPlanner', () => {
  // The hero canvas at a 1440×900 viewport (170% of the stage width).
  const W = 2448
  const H = 824
  const options = { padding: 0.05, headroom: 0.1, step: 16, shrinkAfterMs: 1000 }
  const contains = (crop: { x: number; width: number }, min: number, max: number) =>
    crop.x <= min && crop.x + crop.width >= max

  it('uses the fixed centred window until the avatar extent is known', () => {
    const planner = createRenderCropPlanner({ fallbackAspect: 1.6 })
    expect(planner.update(W, H, null, 0)).toEqual(computeRenderCrop(W, H, 1.6))
  })

  it('fits the measured silhouette plus padding, snapped outward to the step', () => {
    const planner = createRenderCropPlanner(options)
    const crop = planner.update(W, H, { min: 900, max: 1550 }, 0)
    expect(contains(crop, 900 - 0.05 * H, 1550 + 0.05 * H)).toBe(true)
    expect(crop.x % 16).toBe(0)
    expect((crop.x + crop.width) % 16).toBe(0)
    // Far narrower than the frame, so the pixel saving is kept.
    expect(crop.width).toBeLessThan(W * 0.4)
  })

  it('follows an off-centre avatar instead of staying centred on the frame', () => {
    const planner = createRenderCropPlanner(options)
    const crop = planner.update(W, H, { min: 1500, max: 2100 }, 0)
    expect(contains(crop, 1500, 2100)).toBe(true)
    expect(crop.x + crop.width / 2).toBeGreaterThan(W / 2 + 300)
  })

  it('grows in the same frame a gesture leaves the crop, keeping the side that fits', () => {
    const planner = createRenderCropPlanner(options)
    const rest = planner.update(W, H, { min: 900, max: 1550 }, 0)
    // A hand thrown out to the right (the intro, 0_2 and 4_3 gestures reach 2.4-3.3 half-heights).
    const grown = planner.update(W, H, { min: 900, max: 2300 }, 16)
    expect(contains(grown, 900, 2300 + 0.05 * H)).toBe(true)
    expect(grown.x).toBeLessThanOrEqual(rest.x)
  })

  it('never extends past the frame', () => {
    const planner = createRenderCropPlanner(options)
    expect(planner.update(W, H, { min: -400, max: W + 400 }, 0)).toEqual({ x: 0, width: W })
  })

  it('holds a grown crop through the return motion and shrinks only after a delay', () => {
    const planner = createRenderCropPlanner(options)
    planner.update(W, H, { min: 900, max: 1550 }, 0)
    const grown = planner.update(W, H, { min: 900, max: 2300 }, 16)
    // The arm comes back down: no reallocation yet.
    expect(planner.update(W, H, { min: 900, max: 1550 }, 32)).toEqual(grown)
    expect(planner.update(W, H, { min: 900, max: 1550 }, 900)).toEqual(grown)
    const shrunk = planner.update(W, H, { min: 900, max: 1550 }, 1100)
    expect(shrunk.width).toBeLessThan(grown.width)
    expect(contains(shrunk, 900 - 0.05 * H, 1550 + 0.05 * H)).toBe(true)
  })

  it('does not shrink for a saving below the threshold', () => {
    const planner = createRenderCropPlanner({ ...options, shrinkThreshold: 0.15 })
    const first = planner.update(W, H, { min: 900, max: 1550 }, 0)
    expect(planner.update(W, H, { min: 920, max: 1530 }, 5000)).toEqual(first)
    expect(planner.update(W, H, { min: 920, max: 1530 }, 10000)).toEqual(first)
  })

  it('re-plans from scratch when the frame is resized', () => {
    const planner = createRenderCropPlanner(options)
    planner.update(W, H, { min: 900, max: 2300 }, 0)
    const resized = planner.update(1200, 400, { min: 450, max: 750 }, 16)
    expect(contains(resized, 450, 750)).toBe(true)
    expect(resized.x + resized.width).toBeLessThanOrEqual(1200)
    expect(resized.width).toBeLessThan(500)
  })
})
