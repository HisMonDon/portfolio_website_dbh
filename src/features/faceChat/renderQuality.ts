// Quality tiers for the realistic avatar pipeline, plus the frame-time controller that moves
// between them. Everything here is pure (no DOM / WebGL access) so it can be unit tested.

export type QualityTierId = 'ultra' | 'high' | 'medium' | 'low'

export interface QualityTier {
  id: QualityTierId
  // Upper bound for the renderer pixel ratio (the device ratio is used when it is lower).
  pixelRatioCap: number
  // MSAA samples for the HDR scene target. Always >= 2 so hair alpha-to-coverage keeps working.
  msaaSamples: number
  // Screen-space ambient occlusion (GTAO) and the resolution it runs at, relative to the frame.
  ambientOcclusion: boolean
  aoResolutionScale: number
  // HUD-masked bloom.
  bloom: boolean
  shadowMapSize: number
  // PCF kernel radius in shadow-map texels.
  shadowRadius: number
  // Film grain + vignette in the final composite.
  filmGrain: boolean
}

// Ordered best → cheapest. The adaptive controller only ever steps one index at a time.
export const QUALITY_TIER_ORDER: readonly QualityTierId[] = ['ultra', 'high', 'medium', 'low']

export const QUALITY_TIERS: Readonly<Record<QualityTierId, QualityTier>> = {
  ultra: {
    id: 'ultra',
    pixelRatioCap: 2,
    msaaSamples: 4,
    ambientOcclusion: true,
    aoResolutionScale: 0.5,
    bloom: true,
    shadowMapSize: 2048,
    shadowRadius: 3,
    filmGrain: true,
  },
  high: {
    id: 'high',
    pixelRatioCap: 1.5,
    msaaSamples: 4,
    ambientOcclusion: true,
    aoResolutionScale: 0.5,
    bloom: true,
    shadowMapSize: 2048,
    shadowRadius: 3,
    filmGrain: true,
  },
  medium: {
    id: 'medium',
    pixelRatioCap: 1.25,
    msaaSamples: 4,
    ambientOcclusion: false,
    aoResolutionScale: 0.5,
    bloom: true,
    shadowMapSize: 1024,
    shadowRadius: 2,
    filmGrain: true,
  },
  low: {
    id: 'low',
    pixelRatioCap: 1,
    msaaSamples: 2,
    ambientOcclusion: false,
    aoResolutionScale: 0.5,
    bloom: false,
    shadowMapSize: 1024,
    shadowRadius: 1.5,
    filmGrain: false,
  },
}

export interface QualityEnvironment {
  devicePixelRatio: number
  isMobile: boolean
  hardwareConcurrency?: number
  // UNMASKED_RENDERER_WEBGL string when the browser exposes it.
  gpuRenderer?: string | null
  // A `?quality=` override, e.g. for screenshots or debugging.
  override?: string | null
}

export function isQualityTierId(value: unknown): value is QualityTierId {
  return typeof value === 'string' && (QUALITY_TIER_ORDER as readonly string[]).includes(value)
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|basic render/i
const LOW_END_GPU = /mali-4|mali-t|adreno \(tm\) [1-5]\d\d|powervr|intel\(r\) (hd|uhd) graphics [1-6]\d\d\b|gma/i
const DISCRETE_GPU = /nvidia|geforce|rtx|quadro|radeon (rx|pro)|apple m[1-9] (pro|max|ultra)/i

// Picks the starting tier. The adaptive controller corrects it within a few seconds either way,
// so this only needs to avoid an obviously wrong first impression (e.g. ultra on a phone).
export function selectInitialTier(environment: QualityEnvironment): QualityTierId {
  if (isQualityTierId(environment.override)) return environment.override

  const gpu = environment.gpuRenderer ?? ''

  if (SOFTWARE_RENDERER.test(gpu)) return 'low'
  if (environment.isMobile) return LOW_END_GPU.test(gpu) ? 'low' : 'medium'
  if (LOW_END_GPU.test(gpu)) return 'medium'
  if ((environment.hardwareConcurrency ?? 8) <= 2) return 'medium'
  if (DISCRETE_GPU.test(gpu)) return 'ultra'

  // Integrated laptop GPUs (Intel Iris/Arc, AMD APUs, base Apple silicon) start at high.
  return 'high'
}

export function effectivePixelRatio(tier: QualityTier, devicePixelRatio: number) {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(ratio, tier.pixelRatioCap)
}

export interface AdaptiveQualityOptions {
  // Ignore samples for this long after start / after every tier switch (shader compiles, uploads).
  warmupMs?: number
  // Smoothing factor for the exponential moving averages.
  smoothing?: number
  // Step down when the smoothed rAF interval exceeds budget * this for `downgradeAfterMs`...
  downgradeRatio?: number
  downgradeAfterMs?: number
  // ...or when measured GPU time for the avatar alone exceeds budget * this (the rest of the page
  // needs the remainder).
  gpuDowngradeRatio?: number
  // With GPU timing, slow rAF intervals only trigger a downgrade if the avatar's GPU time is at
  // least this share of the budget.
  gpuShareForIntervalDowngrade?: number
  // With GPU timing: step up once GPU time stays below budget * this (the next tier costs roughly
  // 1.5-2x) for `gpuUpgradeAfterMs`.
  gpuUpgradeRatio?: number
  gpuUpgradeAfterMs?: number
  // Without GPU timing the rAF interval cannot show headroom (it is capped by vsync), so upgrades
  // are speculative and rare: after this long inside budget.
  upgradeAfterMs?: number
  upgradeRatio?: number
  // Gaps longer than this (tab hidden, debugger) are discarded.
  maxSampleMs?: number
  // Never step above this tier.
  ceiling?: QualityTierId
}

export interface AdaptiveQualityController {
  readonly tier: QualityTierId
  readonly smoothedFrameMs: number
  readonly smoothedGpuMs: number | null
  // Feed one rAF-to-rAF interval, plus the latest GPU frame time when available. Returns the new
  // tier when it changes, otherwise null. Every failed upgrade doubles the wait before the next.
  sample: (intervalMs: number, nowMs: number, budgetMs: number, gpuMs?: number | null) => QualityTierId | null
}

export function createAdaptiveQuality(
  initial: QualityTierId,
  startMs: number,
  options: AdaptiveQualityOptions = {},
): AdaptiveQualityController {
  const warmupMs = options.warmupMs ?? 2500
  const smoothing = options.smoothing ?? 0.08
  const downgradeRatio = options.downgradeRatio ?? 1.22
  const downgradeAfterMs = options.downgradeAfterMs ?? 1200
  const gpuDowngradeRatio = options.gpuDowngradeRatio ?? 0.8
  const gpuShareForIntervalDowngrade = options.gpuShareForIntervalDowngrade ?? 0.55
  const gpuUpgradeRatio = options.gpuUpgradeRatio ?? 0.42
  const gpuUpgradeAfterMs = options.gpuUpgradeAfterMs ?? 5000
  const upgradeRatio = options.upgradeRatio ?? 1.06
  const baseUpgradeAfterMs = options.upgradeAfterMs ?? 20000
  const maxSampleMs = options.maxSampleMs ?? 250
  const ceilingIndex = QUALITY_TIER_ORDER.indexOf(options.ceiling ?? 'ultra')

  let tierIndex = Math.max(QUALITY_TIER_ORDER.indexOf(initial), ceilingIndex)
  let smoothed = 0
  let smoothedGpu = 0
  let settledAt = startMs
  let overBudgetSince: number | null = null
  let underBudgetSince: number | null = null
  let backoff = 1
  // Set while an upgrade is being evaluated; a quick downgrade means it failed.
  let pendingUpgrade = false

  const switchTo = (index: number, nowMs: number) => {
    tierIndex = index
    settledAt = nowMs
    smoothed = 0
    smoothedGpu = 0
    overBudgetSince = null
    underBudgetSince = null
    return QUALITY_TIER_ORDER[index]
  }

  return {
    get tier() {
      return QUALITY_TIER_ORDER[tierIndex]
    },
    get smoothedFrameMs() {
      return smoothed
    },
    get smoothedGpuMs() {
      return smoothedGpu > 0 ? smoothedGpu : null
    },
    sample(intervalMs, nowMs, budgetMs, gpuMs = null) {
      if (!(intervalMs > 0) || intervalMs > maxSampleMs) return null
      if (nowMs - settledAt < warmupMs) return null

      smoothed = smoothed === 0 ? intervalMs : smoothed + (intervalMs - smoothed) * smoothing
      if (gpuMs !== null && gpuMs > 0 && gpuMs < maxSampleMs) {
        smoothedGpu = smoothedGpu === 0 ? gpuMs : smoothedGpu + (gpuMs - smoothedGpu) * smoothing
      }
      const hasGpu = smoothedGpu > 0

      // Slow frames only count against the avatar when it is a meaningful share of the frame.
      // If GPU timing shows it is cheap, the time is going elsewhere (other page content, main
      // thread) and lowering avatar quality would not help.
      const intervalOverBudget = smoothed > budgetMs * downgradeRatio
        && (!hasGpu || smoothedGpu > budgetMs * gpuShareForIntervalDowngrade)
      const overBudget = intervalOverBudget || (hasGpu && smoothedGpu > budgetMs * gpuDowngradeRatio)

      if (overBudget) {
        underBudgetSince = null
        overBudgetSince ??= nowMs

        if (nowMs - overBudgetSince >= downgradeAfterMs && tierIndex < QUALITY_TIER_ORDER.length - 1) {
          if (pendingUpgrade) {
            backoff *= 2
            pendingUpgrade = false
          }
          return switchTo(tierIndex + 1, nowMs)
        }

        return null
      }

      overBudgetSince = null

      const comfortable = hasGpu
        ? smoothedGpu <= budgetMs * gpuUpgradeRatio && smoothed <= budgetMs * upgradeRatio
        : smoothed <= budgetMs * upgradeRatio

      if (!comfortable) {
        underBudgetSince = null
        return null
      }

      underBudgetSince ??= nowMs
      const heldFor = nowMs - underBudgetSince

      if (pendingUpgrade && heldFor >= downgradeAfterMs * 4) {
        // The upgrade held; reset the back-off.
        pendingUpgrade = false
        backoff = 1
      }

      const upgradeDelay = (hasGpu ? gpuUpgradeAfterMs : baseUpgradeAfterMs) * backoff
      if (heldFor >= upgradeDelay && tierIndex > ceilingIndex) {
        pendingUpgrade = true
        return switchTo(tierIndex - 1, nowMs)
      }

      return null
    },
  }
}

// Horizontal crop of the render area. The avatar canvas is laid out much wider than the bust it
// shows (170% of the stage); rendering only a window around the avatar and offsetting the
// projection to match keeps the picture identical while skipping the empty pixels.
export interface RenderCrop {
  x: number
  width: number
}

// Fixed centred window, used only until the avatar's real extent is known (before the model loads).
export function computeRenderCrop(containerWidth: number, containerHeight: number, maxAspect: number): RenderCrop {
  const width = Math.max(1, Math.round(containerWidth))
  const height = Math.max(1, Math.round(containerHeight))
  const cropWidth = Math.min(width, Math.max(1, Math.round(height * maxAspect)))

  return { x: Math.round((width - cropWidth) / 2), width: cropWidth }
}

export interface RenderCropPlannerOptions {
  // Empty space kept on each side of the measured silhouette, as a fraction of the frame height.
  padding?: number
  // Extra room added whenever the crop has to grow, so a moving hand does not regrow it every
  // frame (each resize reallocates the render targets), as a fraction of the frame height.
  headroom?: number
  // Crop edges snap outward to multiples of this many CSS pixels.
  step?: number
  // The crop shrinks back only after it has been oversized for this long.
  shrinkAfterMs?: number
  // Shrink only when it would save at least this fraction of the current width.
  shrinkThreshold?: number
  // Window used while the avatar extent is unknown, in frame heights (centred).
  fallbackAspect?: number
}

export interface RenderCropPlanner {
  readonly crop: RenderCrop | null
  // Returns the crop to render this frame. `extent` is the avatar's horizontal span in
  // full-frame CSS pixels, or null while it is unknown. Growth is immediate (never a frame with a
  // cut-off silhouette); shrinking waits `shrinkAfterMs`.
  update: (frameWidth: number, frameHeight: number, extent: { min: number; max: number } | null, nowMs: number) => RenderCrop
  reset: () => void
}

export function createRenderCropPlanner(options: RenderCropPlannerOptions = {}): RenderCropPlanner {
  const padding = options.padding ?? 0.07
  const headroom = options.headroom ?? 0.18
  const step = Math.max(1, options.step ?? 16)
  const shrinkAfterMs = options.shrinkAfterMs ?? 1500
  const shrinkThreshold = options.shrinkThreshold ?? 0.15
  const fallbackAspect = options.fallbackAspect ?? 1.6

  let crop: RenderCrop | null = null
  let frame = { width: 0, height: 0 }
  let oversizedSince: number | null = null

  const snap = (left: number, right: number, width: number): RenderCrop => {
    const x = Math.max(0, Math.floor(left / step) * step)
    const end = Math.min(width, Math.ceil(right / step) * step)
    return { x, width: Math.max(1, end - x) }
  }

  return {
    get crop() {
      return crop
    },
    reset() {
      crop = null
      oversizedSince = null
    },
    update(frameWidth, frameHeight, extent, nowMs) {
      const width = Math.max(1, Math.round(frameWidth))
      const height = Math.max(1, Math.round(frameHeight))

      if (width !== frame.width || height !== frame.height) {
        frame = { width, height }
        crop = null
        oversizedSince = null
      }

      if (!extent || !(extent.max > extent.min)) {
        crop ??= computeRenderCrop(width, height, fallbackAspect)
        return crop
      }

      const pad = padding * height
      const needLeft = Math.max(0, extent.min - pad)
      const needRight = Math.min(width, extent.max + pad)

      if (needRight <= needLeft) {
        // The avatar is entirely outside the frame horizontally; keep whatever we have.
        crop ??= computeRenderCrop(width, height, fallbackAspect)
        return crop
      }

      const slack = headroom * height
      const ideal = snap(needLeft - slack, needRight + slack, width)

      if (!crop || needLeft < crop.x || needRight > crop.x + crop.width) {
        // Grow now, keeping the side that already fits so the crop does not oscillate.
        const left = crop ? Math.min(crop.x, ideal.x) : ideal.x
        const right = crop ? Math.max(crop.x + crop.width, ideal.x + ideal.width) : ideal.x + ideal.width
        crop = snap(left, right, width)
        oversizedSince = null
        return crop
      }

      if (ideal.width < crop.width * (1 - shrinkThreshold)) {
        oversizedSince ??= nowMs
        if (nowMs - oversizedSince >= shrinkAfterMs) {
          crop = ideal
          oversizedSince = null
        }
      } else {
        oversizedSince = null
      }

      return crop
    },
  }
}
