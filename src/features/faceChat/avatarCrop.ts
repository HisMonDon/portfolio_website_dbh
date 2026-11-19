import * as THREE from 'three'

// Measures how wide the avatar actually is on screen, so the realistic path's render crop
// (renderQuality.ts → createRenderCropPlanner) can follow the real silhouette instead of a fixed
// window. Recorded gestures put a hand up to ~3.3 canvas half-heights from the centre (intro,
// 0_2, 4_3), far outside the old fixed ±1.6 window.
//
// Skinning 40k vertices per frame on the CPU is far too slow, so the silhouette is approximated
// by spheres swept along the skeleton: a head sphere that covers the hair, the shoulders, both
// arm chains out to the fingertips, and the chest. The radii were checked against the skinned
// vertex bounds of every recorded clip (see avatarCrop.test.ts for the projection maths).

interface ProbeSegment {
  from: THREE.Object3D
  // Second bone of the segment. Without one the probe is a single sphere at `from`.
  to?: THREE.Object3D
  // Offset from `from`, in metres along the bone's own (unscaled) axes.
  offset?: THREE.Vector3
  // Sample positions along from → to; values above 1 extrapolate past `to` (fingertips).
  steps: readonly number[]
  radius: number
}

export interface AvatarExtentProbe {
  segments: ProbeSegment[]
}

// Horizontal extent in full-frame CSS pixels (0 = left edge of the uncropped frame).
export interface HorizontalExtent {
  min: number
  max: number
}

// Dense enough that the spheres overlap even when a forearm points straight at the camera.
const ARM_STEPS = [0.2, 0.4, 0.6, 0.8, 1] as const
const HAND_STEPS = [0, 0.5, 1] as const
const HEAD_CENTER_OFFSET = new THREE.Vector3(0, 0.085, 0.015)

export function createAvatarExtentProbe(root: THREE.Object3D): AvatarExtentProbe | null {
  const bone = (name: string) => root.getObjectByName(name) ?? undefined
  let head: THREE.Object3D | undefined
  root.traverse((object) => {
    if (!head && (object as THREE.Bone).isBone && /head/i.test(object.name)) head = object
  })

  const segments: ProbeSegment[] = []
  const push = (segment: Omit<ProbeSegment, 'from'> & { from?: THREE.Object3D }) => {
    if (segment.from) segments.push(segment as ProbeSegment)
  }

  // Head + hair.
  push({ from: head, offset: HEAD_CENTER_OFFSET, steps: [0], radius: 0.13 })

  // Chest and shoulder line. The suit's shoulders sit ~6 cm outside the arm joints.
  push({ from: bone('Spine2'), steps: [0], radius: 0.2 })
  push({ from: bone('Spine1'), steps: [0], radius: 0.2 })

  for (const side of ['Left', 'Right'] as const) {
    const arm = bone(`${side}Arm`)
    const fore = bone(`${side}ForeArm`)
    const hand = bone(`${side}Hand`)
    const knuckle = bone(`${side}HandMiddle1`)

    push({ from: arm, steps: [0], radius: 0.1 })
    if (arm && fore) push({ from: arm, to: fore, steps: ARM_STEPS, radius: 0.085 })
    if (fore && hand) push({ from: fore, to: hand, steps: ARM_STEPS, radius: 0.07 })
    if (hand && knuckle) {
      // Fingers can point any way from the knuckles (curled, raised, spread), so the knuckle
      // spheres are as big as a finger is long rather than extrapolated along the palm.
      push({ from: hand, to: knuckle, steps: HAND_STEPS, radius: 0.1 })
    } else if (hand) {
      push({ from: hand, steps: [0], radius: 0.16 })
    }
  }

  return segments.length > 0 ? { segments } : null
}

const fromWorld = new THREE.Vector3()
const toWorld = new THREE.Vector3()
const point = new THREE.Vector3()
const offsetWorld = new THREE.Vector3()
const boneQuaternion = new THREE.Quaternion()

// Projects every probe sphere through `camera` (ignoring any view offset, i.e. as if the full
// frame were rendered) and returns the horizontal span of the spheres that overlap the visible
// frame vertically. Bone and camera world matrices must be current.
export function measureAvatarExtent(
  probe: AvatarExtentProbe,
  camera: THREE.PerspectiveCamera,
  fullWidth: number,
  fullHeight: number,
): HorizontalExtent | null {
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom
  const halfHeightPx = fullHeight / 2
  const centerPx = fullWidth / 2
  let min = Infinity
  let max = -Infinity

  for (const segment of probe.segments) {
    segment.from.getWorldPosition(fromWorld)
    if (segment.offset) {
      segment.from.getWorldQuaternion(boneQuaternion)
      fromWorld.add(offsetWorld.copy(segment.offset).applyQuaternion(boneQuaternion))
    }
    if (segment.to) segment.to.getWorldPosition(toWorld)

    for (const step of segment.steps) {
      if (segment.to) point.lerpVectors(fromWorld, toWorld, step)
      else point.copy(fromWorld)

      point.applyMatrix4(camera.matrixWorldInverse)
      const depth = -point.z
      if (depth <= camera.near) continue

      // Units of half the frame height, so x and y share a scale regardless of aspect ratio.
      const scale = 1 / (depth * tanHalfFov)
      const u = point.x * scale
      const v = point.y * scale
      const r = segment.radius * scale

      if (v - r > 1 || v + r < -1) continue

      min = Math.min(min, centerPx + (u - r) * halfHeightPx)
      max = Math.max(max, centerPx + (u + r) * halfHeightPx)
    }
  }

  return min < max ? { min, max } : null
}
