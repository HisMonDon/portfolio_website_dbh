import * as THREE from 'three'

// The Detroit-style temple LED: a rotating ring with pulsing ticks, a soft additive glow, and a
// tiny practical point light so the ring casts its colour back onto the skin. Shared by the
// realistic and legacy render paths; only the emissive scale and light strength differ.

const TEMPLE_HUD_RADIUS = 0.006
const TEMPLE_HUD_TICK_COUNT = 6
const TEMPLE_HUD_ROTATION_SPEED = 0.6
const TEMPLE_HUD_PULSE_SPEED = 1.8
export const TEMPLE_HUD_IDLE_COLOR = 0x33e6ff
export const TEMPLE_HUD_CRITICAL_COLOR = 0xff3b30
const TEMPLE_HUD_CRITICAL_DIM_COLOR = 0x330000
const TEMPLE_HUD_CRITICAL_BLINK_MS = 220
export const TEMPLE_HUD_CONTACT_COLOR = 0xffc233
const TEMPLE_HUD_CONTACT_TICK_COLOR = 0xffe38a

export interface TempleHudOptions {
  // Multiplies the ring/tick colours. Values above 1 push the LED into HDR so the HUD-masked
  // bloom picks it up; the legacy path renders straight to the canvas and keeps 1.
  emissiveScale?: number
  // Multiplies the practical light that tints the nearby skin.
  lightScale?: number
  // Scene layer for the HUD meshes (the realistic path uses it to keep the LED out of shadows/AO).
  layer?: number
}

export interface TempleHud {
  ring: THREE.Group
  mount: THREE.Group
  mainMaterial: THREE.MeshBasicMaterial
  glowMaterial: THREE.MeshBasicMaterial
  tickMaterials: THREE.MeshBasicMaterial[]
  light: THREE.PointLight
  flickerUntil: number
  nextFlickerAt: number
  angle: number
  lastUpdateMs: number | null
  emissiveScale: number
  lightScale: number
  // Current ring colour (unscaled hex) and overall brightness 0..1, for bloom masking.
  color: THREE.Color
  brightness: number
}

export function createTempleHud(headNode: THREE.Object3D, nowMs: number, options: TempleHudOptions = {}): TempleHud {
  const mount = new THREE.Group()
  mount.name = 'TempleHudMount'
  headNode.add(mount)
  headNode.updateMatrixWorld(true)

  // Exact calibrated left-temple world position from phase5-recording/test.js.
  const restWorldPosition = new THREE.Vector3(-0.06, 1.707, 0.08)
  mount.position.copy(headNode.worldToLocal(restWorldPosition.clone()))
  mount.rotation.y = -Math.PI / 2

  const ring = new THREE.Group()
  ring.name = 'TempleHudRing'
  mount.add(ring)

  const mainMaterial = new THREE.MeshBasicMaterial({
    color: TEMPLE_HUD_IDLE_COLOR,
    toneMapped: false,
  })
  const mainRing = new THREE.Mesh(
    new THREE.TorusGeometry(TEMPLE_HUD_RADIUS, 0.0012, 8, 48),
    mainMaterial,
  )
  ring.add(mainRing)

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: TEMPLE_HUD_IDLE_COLOR,
    toneMapped: false,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(TEMPLE_HUD_RADIUS, 0.004, 8, 48),
    glowMaterial,
  )
  ring.add(glowRing)

  const tickMaterials: THREE.MeshBasicMaterial[] = []

  for (let index = 0; index < TEMPLE_HUD_TICK_COUNT; index += 1) {
    const angle = (index / TEMPLE_HUD_TICK_COUNT) * Math.PI * 2
    const tickMaterial = new THREE.MeshBasicMaterial({
      color: 0xd8fbff,
      toneMapped: false,
      transparent: true,
      opacity: 0.8,
    })
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.0018, 0.0042, 0.0008),
      tickMaterial,
    )

    tick.position.set(
      Math.cos(angle) * TEMPLE_HUD_RADIUS,
      Math.sin(angle) * TEMPLE_HUD_RADIUS,
      0,
    )
    tick.rotation.z = angle + Math.PI / 2
    ring.add(tick)
    tickMaterials.push(tickMaterial)
  }

  if (options.layer !== undefined) {
    const layer = options.layer
    ring.traverse((object) => object.layers.set(layer))
  }

  // The source includes a tiny practical light so the ring casts cyan back onto nearby skin.
  const light = new THREE.PointLight(TEMPLE_HUD_IDLE_COLOR, 0.05, 0.15, 2)
  mount.add(light)

  return {
    ring,
    mount,
    mainMaterial,
    glowMaterial,
    tickMaterials,
    light,
    flickerUntil: nowMs + 900,
    nextFlickerAt: nowMs + 5000 + Math.random() * 8000,
    angle: 0,
    lastUpdateMs: null,
    emissiveScale: options.emissiveScale ?? 1,
    lightScale: options.lightScale ?? 1,
    color: new THREE.Color(TEMPLE_HUD_IDLE_COLOR),
    brightness: 1,
  }
}

export function updateTempleHud(
  templeHud: TempleHud,
  nowMs: number,
  jawOpenAmount: number,
  critical = false,
  yellowHud = false,
) {
  const elapsedSeconds = nowMs / 1000
  const deltaSeconds = templeHud.lastUpdateMs === null
    ? 0
    : Math.min((nowMs - templeHud.lastUpdateMs) / 1000, 0.1)
  templeHud.lastUpdateMs = nowMs

  let ringColor: number
  let tickColor: number
  let speedMultiplier: number

  // Contact mode intentionally takes precedence over the error blink so the temple HUD
  // remains yellow for the entire time that section is active.
  if (yellowHud) {
    ringColor = TEMPLE_HUD_CONTACT_COLOR
    tickColor = TEMPLE_HUD_CONTACT_TICK_COLOR
    speedMultiplier = 1 + jawOpenAmount * 1.2
  } else if (critical) {
    const blinkOn = Math.floor(nowMs / TEMPLE_HUD_CRITICAL_BLINK_MS) % 2 === 0
    ringColor = blinkOn ? TEMPLE_HUD_CRITICAL_COLOR : TEMPLE_HUD_CRITICAL_DIM_COLOR
    tickColor = blinkOn ? 0xff9c94 : TEMPLE_HUD_CRITICAL_DIM_COLOR
    speedMultiplier = 2.6
  } else {
    if (nowMs >= templeHud.nextFlickerAt) {
      templeHud.flickerUntil = nowMs + 70 + Math.random() * 120
      templeHud.nextFlickerAt = nowMs + 4500 + Math.random() * 8500
    }

    const flickeringAmber = nowMs < templeHud.flickerUntil
      && Math.floor(nowMs / 45) % 2 === 0
    ringColor = flickeringAmber ? TEMPLE_HUD_CONTACT_COLOR : TEMPLE_HUD_IDLE_COLOR
    tickColor = flickeringAmber ? TEMPLE_HUD_CONTACT_TICK_COLOR : 0xd8fbff
    speedMultiplier = 1 + jawOpenAmount * 1.2
  }

  const scale = templeHud.emissiveScale
  templeHud.mainMaterial.color.setHex(ringColor).multiplyScalar(scale)
  templeHud.glowMaterial.color.setHex(ringColor).multiplyScalar(scale)
  templeHud.tickMaterials.forEach((material) => material.color.setHex(tickColor).multiplyScalar(scale))
  templeHud.color.setHex(ringColor)
  templeHud.brightness = ringColor === TEMPLE_HUD_CRITICAL_DIM_COLOR ? 0.15 : 1

  templeHud.angle += deltaSeconds * TEMPLE_HUD_ROTATION_SPEED * speedMultiplier
  templeHud.ring.rotation.z = templeHud.angle

  const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * TEMPLE_HUD_PULSE_SPEED)
  templeHud.glowMaterial.opacity = 0.2 + 0.3 * pulse
  templeHud.tickMaterials.forEach((material, index) => {
    const phase = elapsedSeconds * TEMPLE_HUD_PULSE_SPEED
      + (index / templeHud.tickMaterials.length) * Math.PI * 2
    material.opacity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(phase))
  })

  templeHud.light.color.setHex(ringColor)
  templeHud.light.intensity = ((critical && !yellowHud ? 0.03 : 0.05) + 0.04 * pulse) * templeHud.lightScale

  return { pulse, ringColor }
}

export function findHeadNode(root: THREE.Object3D) {
  let headNode: THREE.Object3D | null = null

  root.traverse((object) => {
    const bone = object as THREE.Bone
    if (!headNode && bone.isBone && /head/i.test(bone.name)) headNode = bone
  })

  if (headNode) return headNode

  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!headNode && mesh.isMesh && /head/i.test(mesh.name)) headNode = mesh
  })

  return headNode ?? root
}
