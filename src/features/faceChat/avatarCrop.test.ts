import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createAvatarExtentProbe, measureAvatarExtent } from './avatarCrop'

// A minimal stand-in for the avatar's skeleton: only the bones the probe reads, placed like the
// real rig in its relaxed pose (head ~1.6 m, shoulders ±0.18 m, arms hanging down).
function buildSkeleton(armOutRight = false) {
  const root = new THREE.Group()
  const bone = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const b = new THREE.Bone()
    b.name = name
    b.position.set(x, y, z)
    parent.add(b)
    return b
  }
  const spine1 = bone('Spine1', root, 0, 1.3)
  const spine2 = bone('Spine2', spine1, 0, 0.12)
  bone('Head', spine2, 0, 0.2)
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    const arm = bone(`${side}Arm`, spine2, 0.18 * sign, 0.05)
    const outstretched = armOutRight && side === 'Right'
    const fore = bone(`${side}ForeArm`, arm, outstretched ? -0.28 : 0.02 * sign, outstretched ? 0 : -0.27)
    const hand = bone(`${side}Hand`, fore, outstretched ? -0.25 : 0, outstretched ? 0 : -0.25)
    bone(`${side}HandMiddle1`, hand, outstretched ? -0.1 : 0, outstretched ? 0 : -0.1)
  }
  root.updateMatrixWorld(true)
  return root
}

// The hero camera: 33° vertical FOV, 1 m in front of the avatar, aimed just above eye level.
function heroCamera(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(33, width / height, 0.1, 100)
  camera.position.set(0, 1.63, 1)
  camera.lookAt(0, 1.67, 0)
  camera.updateMatrixWorld()
  return camera
}

// The hero canvas at a 1440×900 viewport (170% of the stage width).
const W = 2448
const H = 824
const OLD_WINDOW_HALF = 1.6 * (H / 2)

function measure(root: THREE.Object3D, camera = heroCamera(W, H)) {
  const probe = createAvatarExtentProbe(root)
  if (!probe) throw new Error('no probe')
  return measureAvatarExtent(probe, camera, W, H)
}

describe('measureAvatarExtent', () => {
  it('is centred on the frame for a centred avatar', () => {
    const extent = measure(buildSkeleton())!
    expect((extent.min + extent.max) / 2).toBeCloseTo(W / 2, -1)
    // Head-and-shoulders bust: roughly ±0.3 m at 1 m, i.e. about one frame height wide.
    expect(extent.max - extent.min).toBeGreaterThan(H * 0.7)
    expect(extent.max - extent.min).toBeLessThan(H * 1.6)
  })

  it('follows the avatar when it stands off-centre', () => {
    const root = buildSkeleton()
    const centred = measure(root)!
    root.position.x = 0.1
    root.updateMatrixWorld(true)
    const shifted = measure(root)!
    // 10 cm at 1 m with a 33° FOV ≈ 0.34 half-heights ≈ 140 px.
    expect(shifted.min - centred.min).toBeGreaterThan(100)
    expect(shifted.max - centred.max).toBeGreaterThan(100)
  })

  it('includes an outstretched arm far beyond the old fixed ±1.6 half-height window', () => {
    const extent = measure(buildSkeleton(true))!
    expect(extent.min).toBeLessThan(W / 2 - OLD_WINDOW_HALF)
    // The other side is unaffected.
    expect(extent.max).toBeLessThan(W / 2 + OLD_WINDOW_HALF)
  })

  it('tracks the arm as the avatar turns (scroll rotation)', () => {
    const root = buildSkeleton(true)
    const front = measure(root)!
    root.rotation.y = Math.PI / 2
    root.updateMatrixWorld(true)
    const side = measure(root)!
    // Turned 90°, the outstretched arm points along the view axis: far narrower.
    expect(side.max - side.min).toBeLessThan(front.max - front.min)
    root.rotation.y = Math.PI
    root.updateMatrixWorld(true)
    // Facing away, the arm swaps sides.
    expect(measure(root)!.max).toBeGreaterThan(W / 2 + OLD_WINDOW_HALF)
  })

  it('gets wider when the camera pushes in (personal moment)', () => {
    const root = buildSkeleton()
    const base = measure(root)!
    const close = heroCamera(W, H)
    close.position.z = 0.84
    close.fov = 31
    close.updateProjectionMatrix()
    close.updateMatrixWorld()
    const pushed = measure(root, close)!
    expect(pushed.max - pushed.min).toBeGreaterThan(base.max - base.min)
  })

  it('ignores the view offset, so it measures the full frame while a crop is rendered', () => {
    const root = buildSkeleton()
    const camera = heroCamera(W, H)
    const full = measure(root, camera)
    camera.setViewOffset(W, H, 600, 0, 1200, H)
    camera.updateProjectionMatrix()
    expect(measure(root, camera)).toEqual(full)
  })

  it('skips parts entirely outside the frame vertically', () => {
    const root = buildSkeleton()
    root.position.y = -1
    root.updateMatrixWorld(true)
    expect(measure(root)).toBeNull()
  })
})
