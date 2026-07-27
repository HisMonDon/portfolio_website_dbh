import * as THREE from 'three'
import type {
  InternalFrame,
  RecordedPose,
  RecordedPosition,
  RecordedQuaternion,
} from './clipFormat'

export const CLIP_TRANSITION_DURATION_MS = 320

export function easeClipTransition(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1)
  return clamped * clamped * (3 - 2 * clamped)
}

function interpolateQuaternion(
  from: RecordedQuaternion,
  to: RecordedQuaternion,
  progress: number,
): RecordedQuaternion {
  const interpolated = new THREE.Quaternion()
    .fromArray(from)
    .slerp(new THREE.Quaternion().fromArray(to), progress)
    .normalize()

  return [interpolated.x, interpolated.y, interpolated.z, interpolated.w]
}

function interpolatePosition(
  from: RecordedPosition,
  to: RecordedPosition,
  progress: number,
): RecordedPosition {
  return [
    THREE.MathUtils.lerp(from[0], to[0], progress),
    THREE.MathUtils.lerp(from[1], to[1], progress),
    THREE.MathUtils.lerp(from[2], to[2], progress),
  ]
}

function interpolatePose(
  from: RecordedPose | undefined,
  to: RecordedPose | undefined,
  progress: number,
): RecordedPose | undefined {
  if (!to) return from
  if (!from) return to

  const boneNames = new Set([...Object.keys(from.bones), ...Object.keys(to.bones)])
  const bones: Record<string, RecordedQuaternion> = {}

  boneNames.forEach((name) => {
    const fromQuaternion = from.bones[name]
    const toQuaternion = to.bones[name]

    if (fromQuaternion && toQuaternion) {
      bones[name] = interpolateQuaternion(fromQuaternion, toQuaternion, progress)
    } else {
      bones[name] = toQuaternion ?? fromQuaternion
    }
  })

  const rootPosition = from.rootPosition && to.rootPosition
    ? interpolatePosition(from.rootPosition, to.rootPosition, progress)
    : to.rootPosition ?? from.rootPosition

  return {
    bones,
    ...(rootPosition ? { rootPosition } : {}),
  }
}

// Creates an in-between recording frame across file boundaries. Blendshape scores use a smooth
// cubic ease, body positions lerp, and bone rotations slerp so shoulders/head take the shortest
// rotational path instead of snapping or collapsing through an invalid quaternion.
export function interpolateInternalFrames(
  from: InternalFrame,
  to: InternalFrame,
  progress: number,
): InternalFrame {
  if (progress <= 0) return from
  if (progress >= 1) return to

  const eased = easeClipTransition(progress)
  const fromScores = new Map(
    from.categories.map(({ categoryName, score }) => [categoryName, score]),
  )
  const toScores = new Map(
    to.categories.map(({ categoryName, score }) => [categoryName, score]),
  )
  const categoryNames = [
    ...to.categories.map(({ categoryName }) => categoryName),
    ...from.categories
      .map(({ categoryName }) => categoryName)
      .filter((categoryName) => !toScores.has(categoryName)),
  ]

  return {
    t: to.t,
    categories: categoryNames.map((categoryName) => {
      // A category omitted by one recording is equivalent to a zero-weight morph target in
      // that frame. Fading to/from zero avoids a one-frame pop at either file boundary.
      const fromScore = fromScores.get(categoryName) ?? 0
      const toScore = toScores.get(categoryName) ?? 0

      return {
        categoryName,
        score: THREE.MathUtils.lerp(fromScore, toScore, eased),
      }
    }),
    ...(from.pose || to.pose
      ? { pose: interpolatePose(from.pose, to.pose, eased) }
      : {}),
  }
}
