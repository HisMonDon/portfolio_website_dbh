import * as THREE from 'three'
import type { RecordedPose } from './clipFormat'

// Dev-only tooling for side-by-side render comparisons. Nothing in here runs in production:
// every entry point is gated on import.meta.env.DEV by the caller.
//
//   window.__avatarDebug = { rotation: Math.PI / 4, critical: true }
//   window.__avatarDebug = { capture: { background: '#ff00ff', scale: 0.6 } }
//
// A capture request copies a square crop around the head straight out of the WebGL drawing
// buffer (in the same task as the render, so preserveDrawingBuffer is not needed) into a
// full-screen overlay. Click the overlay to dismiss it.
export interface AvatarDebugOverrides {
  rotation?: number
  critical?: boolean
  yellowHud?: boolean
  personalMoment?: boolean
  // Realistic pipeline tuning: force a quality tier, tone mapper or exposure.
  tier?: 'ultra' | 'high' | 'medium' | 'low'
  toneMapping?: 'neutral' | 'agx' | 'aces'
  exposure?: number
  // Hold a recorded body pose (a clip frame's `pose`) instead of the playing clip's, e.g.
  //   __avatarDebug = { pose: (await (await fetch('/src/features/faceChat/clips/intro.json')).json())[80].pose }
  pose?: RecordedPose
  // Force blendshape scores (e.g. { eyeLookOutLeft: 1, eyeLookInRight: 1 }) on top of the clip.
  blendshapes?: Record<string, number>
  capture?: {
    // CSS colour drawn behind the transparent canvas. Magenta makes alpha halos obvious.
    background?: string
    // Crop size as a fraction of the canvas height.
    scale?: number
    // Crop width / height (default 1, a square). Large values capture the whole canvas width.
    aspect?: number
    // Vertical offset of the crop centre, in world metres above the Head bone.
    lift?: number
    // When set, the crop is POSTed to the screenshot dev server (vite.shots config) under this
    // file name instead of being shown as an overlay.
    save?: string
    // Capture the small project-card preview canvas instead of the hero avatar.
    small?: boolean
  }
}

export function readAvatarDebug(): AvatarDebugOverrides | undefined {
  return (window as unknown as { __avatarDebug?: AvatarDebugOverrides }).__avatarDebug
}

const OVERLAY_ID = 'avatar-debug-capture'

export function captureAvatarCrop(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  head: THREE.Object3D | null,
  request: NonNullable<AvatarDebugOverrides['capture']>,
) {
  const center = new THREE.Vector3(0, 1.66, 0)
  if (head) head.getWorldPosition(center)
  center.y += request.lift ?? 0.02
  center.project(camera)

  const cx = (center.x * 0.5 + 0.5) * canvas.width
  const cy = (1 - (center.y * 0.5 + 0.5)) * canvas.height
  const size = Math.round(canvas.height * (request.scale ?? 0.55))
  const width = Math.min(Math.round(size * (request.aspect ?? 1)), request.aspect ? canvas.width : Infinity)

  document.getElementById(OVERLAY_ID)?.remove()

  const overlay = document.createElement('canvas')
  overlay.id = OVERLAY_ID
  overlay.width = width
  overlay.height = size
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    margin: 'auto',
    height: '100vh',
    width: `${(100 * width) / size}vh`,
    zIndex: '2147483647',
    imageRendering: 'auto',
    cursor: 'pointer',
  })
  overlay.addEventListener('click', () => overlay.remove())

  const context = overlay.getContext('2d')
  if (!context) return

  context.fillStyle = request.background ?? '#dfe9f2'
  context.fillRect(0, 0, width, size)
  const left = request.aspect ? Math.max(0, Math.min(canvas.width - width, cx - width / 2)) : cx - width / 2
  context.drawImage(canvas, left, cy - size / 2, width, size, 0, 0, width, size)

  if (request.save) {
    const name = request.save
    void fetch(`/__avatar-shot?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: overlay.toDataURL(name.endsWith('.png') ? 'image/png' : 'image/jpeg', 0.92),
    })
    return
  }

  document.body.appendChild(overlay)
}

type ShotName = 'mid' | 'idle' | 'critical' | 'contact' | 'closeup' | 'rotated' | 'alpha'

// window.__shoot('after') captures the standard comparison set (mid-sentence, idle, critical,
// contact, close-up, rotated, magenta alpha check) through the capture hook above. Requires the
// screenshot dev server for `save`; dev builds only.
export function installShotHelper() {
  const target = window as unknown as {
    __shoot?: (prefix: string, which?: ShotName[], base?: AvatarDebugOverrides) => Promise<ShotName[]>
    __avatarDebug?: AvatarDebugOverrides
  }
  if (target.__shoot) return

  target.__shoot = async (prefix, which = ['mid', 'idle', 'critical', 'contact', 'closeup', 'rotated'], base = {}) => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const shot = async (
      name: ShotName,
      overrides: AvatarDebugOverrides,
      settle = 900,
      scale = 0.5,
      extra: Partial<NonNullable<AvatarDebugOverrides['capture']>> = {},
    ) => {
      target.__avatarDebug = { ...base, ...overrides }
      await wait(settle)
      if (overrides.critical) {
        // Land inside a blink-on window of the 220 ms critical blink.
        while (Math.floor(performance.now() / 220) % 2 !== 0) await wait(10)
      }
      const request = { ...target.__avatarDebug, capture: { scale, save: `${prefix}_${name}.jpg`, ...extra } }
      target.__avatarDebug = request
      // Wait until the render loop has actually taken the capture (slow frames can exceed 300 ms).
      for (let attempt = 0; attempt < 100 && request.capture; attempt += 1) await wait(30)
      await wait(120)
    }
    const done: ShotName[] = []
    const avatarVisible = () => [...document.querySelectorAll<HTMLCanvasElement>('canvas.clip-avatar-canvas')]
      .some((canvas) => canvas.clientWidth > 600)
    for (let attempt = 0; attempt < 100 && !avatarVisible(); attempt += 1) await wait(150)
    await wait(300)

    if (which.includes('mid')) {
      // A couple of seconds into the intro so the mouth is actually mid-word.
      await shot('mid', {}, 2500)
      done.push('mid')
    }
    if (which.includes('idle') || which.includes('critical')) {
      const skip = [...document.querySelectorAll('button')].find((button) => /skip/i.test(button.textContent ?? ''))
      skip?.click()
      await wait(1500)
    }
    if (which.includes('idle')) {
      await shot('idle', {})
      done.push('idle')
    }
    if (which.includes('critical')) {
      await shot('critical', { critical: true })
      done.push('critical')
    }
    if (which.includes('contact')) {
      await shot('contact', { yellowHud: true })
      done.push('contact')
    }
    if (which.includes('closeup')) {
      await shot('closeup', { personalMoment: true }, 2600)
      done.push('closeup')
    }
    if (which.includes('rotated')) {
      await shot('rotated', { rotation: Math.PI / 4 }, 600)
      done.push('rotated')
    }
    if (which.includes('alpha')) {
      await shot('alpha', {}, 300, 0.75, { background: '#ff00ff' })
      done.push('alpha')
    }

    target.__avatarDebug = { ...base }
    return done
  }
}
