// Converts the ARKit/MediaPipe eye-look blendshapes into eyeball rotations. The GLB only deforms
// the eyelids for eyeLook*; the eyeballs themselves are rigid meshes skinned to the LeftEye /
// RightEye bones, so without this the lids moved while the irises stayed locked forward.

export interface EyeRotation {
  // Radians. Positive yaw turns the eye toward the avatar's left; positive pitch looks up.
  yaw: number
  pitch: number
}

export interface EyeGaze {
  left: EyeRotation
  right: EyeRotation
}

// Comfortable human ranges at a blendshape score of 1.
export const EYE_MAX_YAW = degrees(28)
export const EYE_MAX_PITCH_UP = degrees(20)
export const EYE_MAX_PITCH_DOWN = degrees(24)

function degrees(degrees: number) {
  return (degrees * Math.PI) / 180
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

type ScoreLookup = (name: string) => number

function rotationFor(side: 'Left' | 'Right', score: ScoreLookup): EyeRotation {
  // "Out" means toward the ear on that side; "In" toward the nose. For the avatar's left eye,
  // out = avatar's left (+yaw); for the right eye, out = avatar's right (-yaw).
  const outward = clamp01(score(`eyeLookOut${side}`))
  const inward = clamp01(score(`eyeLookIn${side}`))
  const up = clamp01(score(`eyeLookUp${side}`))
  const down = clamp01(score(`eyeLookDown${side}`))
  const sign = side === 'Left' ? 1 : -1

  // `+ 0` normalises -0 so a neutral gaze compares equal to NEUTRAL_EYE_GAZE.
  return {
    yaw: sign * (outward - inward) * EYE_MAX_YAW + 0,
    pitch: up * EYE_MAX_PITCH_UP - down * EYE_MAX_PITCH_DOWN + 0,
  }
}

export function computeEyeGaze(categories: readonly { categoryName: string; score: number }[]): EyeGaze {
  const scores = new Map<string, number>()
  categories.forEach(({ categoryName, score }) => scores.set(categoryName, score))
  const lookup: ScoreLookup = (name) => scores.get(name) ?? 0

  const left = rotationFor('Left', lookup)
  const right = rotationFor('Right', lookup)

  // Real eyes converge/verge together; average the vertical component so a noisy tracker never
  // produces a wall-eyed vertical split, but keep per-eye yaw for natural convergence.
  const pitch = (left.pitch + right.pitch) / 2

  return {
    left: { yaw: left.yaw, pitch },
    right: { yaw: right.yaw, pitch },
  }
}

// Exponential smoothing toward a target, frame-rate independent.
export function smoothEyeGaze(current: EyeGaze, target: EyeGaze, deltaMs: number, halfLifeMs = 45): EyeGaze {
  const t = 1 - Math.pow(0.5, Math.max(0, deltaMs) / halfLifeMs)
  const mix = (a: number, b: number) => a + (b - a) * t

  return {
    left: { yaw: mix(current.left.yaw, target.left.yaw), pitch: mix(current.left.pitch, target.left.pitch) },
    right: { yaw: mix(current.right.yaw, target.right.yaw), pitch: mix(current.right.pitch, target.right.pitch) },
  }
}

export const NEUTRAL_EYE_GAZE: EyeGaze = {
  left: { yaw: 0, pitch: 0 },
  right: { yaw: 0, pitch: 0 },
}
