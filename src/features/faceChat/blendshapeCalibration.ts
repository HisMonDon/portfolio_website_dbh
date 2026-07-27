import type { ClipFormatFrame } from './clipFormat'

export interface BlendshapeCategory {
  categoryName: string
  score: number
}

export type BlendshapeBaseline = Record<string, number>

// Keep these values in lockstep with phase5-recording/test.js. The recording harness captures
// 60 neutral face samples, removes that resting value from every raw MediaPipe score, applies a
// stronger blink curve, exaggerates the expressive shapes, and smooths non-blink movement.
export const CALIBRATION_FRAME_COUNT = 60
const EYE_BLINK_CURVE = 2.2
const MOUTH_SMOOTHING = 0.4

const EXAGGERATION: Record<string, number> = {
  browDownLeft: 1,
  browDownRight: 1,
  browInnerUp: 1.6,
  browOuterUpLeft: 1.6,
  browOuterUpRight: 1.6,
  cheekPuff: 1.6,
  cheekSquintLeft: 1.6,
  cheekSquintRight: 1.6,
  eyeLookDownLeft: 1.2,
  eyeLookDownRight: 1.2,
  eyeLookInLeft: 2,
  eyeLookInRight: 2,
  eyeLookOutLeft: 2,
  eyeLookOutRight: 2,
  eyeLookUpLeft: 2,
  eyeLookUpRight: 2,
  eyeSquintLeft: 1.3,
  eyeSquintRight: 1.3,
  eyeWideLeft: 2.2,
  eyeWideRight: 2.2,
  jawForward: 1.6,
  jawLeft: 1.6,
  jawRight: 1.6,
  mouthClose: 1.6,
  mouthDimpleLeft: 1.6,
  mouthDimpleRight: 1.6,
  mouthFrownLeft: 1.6,
  mouthFrownRight: 1.6,
  mouthFunnel: 1.6,
  mouthLeft: 1.6,
  mouthLowerDownLeft: 1.6,
  mouthLowerDownRight: 1.6,
  mouthPressLeft: 1.6,
  mouthPressRight: 1.6,
  mouthPucker: 1.6,
  mouthRight: 1.6,
  mouthRollLower: 1.6,
  mouthRollUpper: 1.6,
  mouthShrugLower: 1.6,
  mouthShrugUpper: 1.6,
  mouthSmileLeft: 2.4,
  mouthSmileRight: 2.4,
  mouthStretchLeft: 1.6,
  mouthStretchRight: 1.6,
  mouthUpperUpLeft: 1.6,
  mouthUpperUpRight: 1.6,
  noseSneerLeft: 1.6,
  noseSneerRight: 1.6,
}

// The original calibration baseline lived only in the recording browser's localStorage and was
// deliberately not embedded in exported clips. The idle recording begins with the same neutral
// hold, so its first 60 samples are the portable equivalent for prerecorded playback.
export function buildCalibrationBaseline(
  frames: readonly ClipFormatFrame[],
  sampleCount = CALIBRATION_FRAME_COUNT,
): BlendshapeBaseline {
  const samples = frames.slice(0, Math.max(0, sampleCount))

  if (samples.length === 0) return {}

  const names = samples[samples.length - 1].blendshapes.map(({ name }) => name)
  const baseline: BlendshapeBaseline = {}

  names.forEach((name) => {
    let sum = 0
    let foundCount = 0

    samples.forEach((frame) => {
      const category = frame.blendshapes.find((blendshape) => blendshape.name === name)

      if (!category) return
      sum += category.score
      foundCount += 1
    })

    if (foundCount > 0) baseline[name] = sum / foundCount
  })

  return baseline
}

export interface BlendshapeCalibrator {
  apply: (categories: readonly BlendshapeCategory[]) => BlendshapeCategory[]
  resetSmoothing: () => void
}

export function createBlendshapeCalibrator(baseline: BlendshapeBaseline): BlendshapeCalibrator {
  let smoothedValues: Record<string, number> = {}

  return {
    apply(categories) {
      return categories.map((category) => {
        const { categoryName } = category
        const base = baseline[categoryName]
        let score = category.score

        if (base !== undefined) {
          score = base >= 1 ? 0 : Math.max(0, (score - base) / (1 - base))

          if (categoryName === 'eyeBlinkLeft' || categoryName === 'eyeBlinkRight') {
            score = Math.pow(score, EYE_BLINK_CURVE)
          } else {
            score *= EXAGGERATION[categoryName] ?? 1
            const previous = smoothedValues[categoryName] ?? 0
            const smoothed = previous + (score - previous) * MOUTH_SMOOTHING
            smoothedValues[categoryName] = smoothed
            score = smoothed
          }
        }

        return {
          categoryName,
          score: Math.min(Math.max(score, 0), 1),
        }
      })
    },

    resetSmoothing() {
      smoothedValues = {}
    },
  }
}
