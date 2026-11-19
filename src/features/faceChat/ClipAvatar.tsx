import { useEffect, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  buildCalibrationBaseline,
  createBlendshapeCalibrator,
  type BlendshapeCalibrator,
  type BlendshapeCategory,
} from './blendshapeCalibration'
import {
  applyAvatarVisualTreatment,
  HUD_LAYER,
  type AvatarVisualController,
} from './avatarVisuals'
import { applyLegacyAvatarVisualTreatment } from './avatarVisualsLegacy'
import { setupLegacyStage, setupRealisticStage, type AvatarStage } from './avatarStage'
import type { AvatarPostProcessing } from './avatarPostProcessing'
import type { InternalFrame, RecordedPose } from './clipFormat'
import { applyBlendshapesToMeshes, loadClip } from './clipPlayback'
import { IDLE_CLIP_ID } from './dialogueGraph'
import { useScrollRotation } from './scrollRotation'
import { captureAvatarCrop, installShotHelper, readAvatarDebug } from './avatarDebug'
import { createAvatarExtentProbe, measureAvatarExtent, type AvatarExtentProbe } from './avatarCrop'
import { currentRenderMode, type AvatarRenderMode } from './renderMode'
import {
  createAdaptiveQuality,
  createRenderCropPlanner,
  effectivePixelRatio,
  QUALITY_TIERS,
  selectInitialTier,
  type AdaptiveQualityController,
  type QualityTierId,
  type RenderCrop,
} from './renderQuality'
import './ClipAvatar.css'

interface ClipAvatarProps {
  // The complete recording frame includes raw face scores plus the calibrated body/head pose.
  activeFrame?: InternalFrame | null
  critical?: boolean
  yellowHud?: boolean
  targetFps?: number
  // True while a personal (non-technical) answer is playing — see FaceChatWidget.tsx. Pushes the
  // camera into a tighter, more intimate framing for the duration of that answer.
  personalMoment?: boolean
  // Fired the first time the avatar model has loaded and is about to render its first frame, so
  // callers can time entrance effects to when there's actually something to reveal.
  onReady?: () => void
}

const RENDERER_RETRY_LIMIT = 2
const AVATAR_URL = new URL('./assets/avatar.glb', import.meta.url).href

// Leave a little breathing room above the hairline on shorter/wider viewports. The previous
// 30-degree framing pushed the top of the head into the HUD at common laptop aspect ratios.
const BASE_CAMERA_FOV = 33
const BASE_CAMERA_POSITION = new THREE.Vector3(0, 1.63, 1)
// Aim slightly above eye level so the portrait sits lower in the frame and the crown remains
// visible even when recorded head motion tilts the avatar toward the camera.
const BASE_CAMERA_LOOKAT = new THREE.Vector3(0, 1.67, 0)
// How much closer/tighter the shot gets during a personal-moment answer.
const PERSONAL_MOMENT_DOLLY = 0.16
const PERSONAL_MOMENT_FOV_DELTA = 2
// Kept deliberately small so the idle sway reads as "alive and restless," not shaky or distracting.
const IDLE_DRIFT_POSITION = 0.025
const IDLE_DRIFT_LOOK = 0.02
// Approach rate (per millisecond) for easing toward the personal-moment dolly target.
const CLOSENESS_EASE_PER_MS = 0.0035
// The realistic path only renders a horizontal window around the avatar: the extra-wide canvas
// is mostly empty, so skipping it roughly halves the pixel cost. The window follows the avatar's
// measured on-screen extent every frame (avatarCrop.ts), so gestures, scroll rotation and the
// personal-moment push-in are never cut off. This is only the window used before the model loads.
const RENDER_CROP_FALLBACK_ASPECT = 1.6

const TONE_MAPPINGS = {
  neutral: THREE.NeutralToneMapping,
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
} as const
const REALISTIC_TONE_MAPPING = THREE.NeutralToneMapping
const REALISTIC_EXPOSURE = 1.0

function detectMobile() {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return coarse && (navigator.maxTouchPoints ?? 0) > 0
}

function readGpuRenderer(renderer: THREE.WebGLRenderer) {
  try {
    const gl = renderer.getContext()
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null
  } catch {
    return null
  }
}

function readQualityOverride() {
  try {
    return new URLSearchParams(window.location.search).get('quality')
  } catch {
    return null
  }
}

function disposeAvatar(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  root.traverse((object) => {
    const mesh = object as THREE.Mesh

    if (!mesh.isMesh) return

    mesh.geometry?.dispose()

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    meshMaterials.forEach((material) => materials.add(material))

    const skinnedMesh = mesh as THREE.SkinnedMesh
    skinnedMesh.skeleton?.dispose()
  })

  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value)
    })
    material.dispose()
  })

  textures.forEach((texture) => texture.dispose())
}

function relaxAvatarArms(root: THREE.Object3D) {
  root.updateMatrixWorld(true)

  const armBones = {
    left: {
      upper: root.getObjectByName('LeftArm'),
      fore: root.getObjectByName('LeftForeArm'),
      hand: root.getObjectByName('LeftHand'),
    },
    right: {
      upper: root.getObjectByName('RightArm'),
      fore: root.getObjectByName('RightForeArm'),
      hand: root.getObjectByName('RightHand'),
    },
  }

  const down = new THREE.Vector3(0, -1, 0)

  const relaxBone = (bone: THREE.Object3D, endBone: THREE.Object3D) => {
    const currentDirection = endBone
      .getWorldPosition(new THREE.Vector3())
      .sub(bone.getWorldPosition(new THREE.Vector3()))
      .normalize()
    const bindWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion())
    const deltaQuaternion = new THREE.Quaternion().setFromUnitVectors(currentDirection, down)
    const desiredWorldQuaternion = deltaQuaternion.multiply(bindWorldQuaternion)
    const parentWorldQuaternion = bone.parent?.getWorldQuaternion(new THREE.Quaternion())

    if (!parentWorldQuaternion) return

    bone.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion))
    bone.updateMatrixWorld(true)
  }

  Object.values(armBones).forEach(({ upper, fore, hand }) => {
    if (!upper || !fore || !hand) return
    relaxBone(upper, fore)
    relaxBone(fore, hand)
  })
}

type PoseBoneRegistry = Record<string, THREE.Object3D | null>

function createPoseBoneRegistry(root: THREE.Object3D): PoseBoneRegistry {
  let head: THREE.Object3D | null = null

  root.traverse((object) => {
    if (!head && object instanceof THREE.Bone && /head/i.test(object.name)) head = object
  })

  return {
    head,
    neck: root.getObjectByName('Neck') ?? null,
    neck1: root.getObjectByName('Neck1') ?? null,
    armLeftUpper: root.getObjectByName('LeftArm') ?? null,
    armLeftFore: root.getObjectByName('LeftForeArm') ?? null,
    armRightUpper: root.getObjectByName('RightArm') ?? null,
    armRightFore: root.getObjectByName('RightForeArm') ?? null,
    handLeft: root.getObjectByName('LeftHand') ?? null,
    handRight: root.getObjectByName('RightHand') ?? null,
    foreArmTwistLeft1: root.getObjectByName('LeftForeArm1') ?? null,
    foreArmTwistLeft2: root.getObjectByName('LeftForeArm2') ?? null,
    foreArmTwistRight1: root.getObjectByName('RightForeArm1') ?? null,
    foreArmTwistRight2: root.getObjectByName('RightForeArm2') ?? null,
    torso: root.getObjectByName('Spine2') ?? null,
    spine: root.getObjectByName('Spine') ?? null,
    spine1: root.getObjectByName('Spine1') ?? null,
  }
}

function applyRecordedPose(
  pose: RecordedPose,
  avatarRoot: THREE.Object3D,
  registry: PoseBoneRegistry,
) {
  Object.entries(pose.bones).forEach(([key, quaternion]) => {
    registry[key]?.quaternion.fromArray(quaternion)
  })

  if (pose.rootPosition) avatarRoot.position.fromArray(pose.rootPosition)
}

// Camera-free Three.js avatar surface for prerecorded clip playback (dialogueGraph.ts /
// clipPlayback.ts). Unlike FaceTrackingAvatar (the live webcam-tracking component), this never
// calls getUserMedia and never needs camera permission — it only renders whatever blendshape
// frames a clip player hands it.
export default function ClipAvatar({
  activeFrame,
  critical = false,
  yellowHud = false,
  targetFps = 60,
  personalMoment = false,
  onReady,
}: ClipAvatarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const morphMeshesRef = useRef<THREE.Mesh[]>([])
  const avatarRootRef = useRef<THREE.Group | null>(null)
  const poseBoneRegistryRef = useRef<PoseBoneRegistry>({})
  const calibratorRef = useRef<BlendshapeCalibrator | null>(null)
  const visualControllerRef = useRef<AvatarVisualController | null>(null)
  const latestCalibratedCategoriesRef = useRef<BlendshapeCategory[] | null>(null)
  const latestPoseRef = useRef<RecordedPose | null>(null)
  const jawOpenAmountRef = useRef(0)
  const criticalRef = useRef(critical)
  const yellowHudRef = useRef(yellowHud)
  const activeFrameRef = useRef(activeFrame)
  const targetFpsRef = useRef(targetFps)
  const personalMomentRef = useRef(personalMoment)
  const closenessRef = useRef(0)
  const [renderMode] = useState<AvatarRenderMode>(currentRenderMode)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rendererAttempt, setRendererAttempt] = useState(0)
  const rotationRef = useScrollRotation()
  const onReadyRef = useRef(onReady)

  onReadyRef.current = onReady

  activeFrameRef.current = activeFrame
  criticalRef.current = critical
  yellowHudRef.current = yellowHud
  targetFpsRef.current = Math.min(60, Math.max(15, targetFps))
  personalMomentRef.current = personalMoment

  const applyCalibrated = (calibrated: BlendshapeCategory[]) => {
    latestCalibratedCategoriesRef.current = calibrated
    jawOpenAmountRef.current = calibrated.find(
      ({ categoryName }) => categoryName === 'jawOpen',
    )?.score ?? 0
    applyBlendshapesToMeshes(calibrated, morphMeshesRef.current)
    visualControllerRef.current?.setBlendshapes?.(calibrated)
  }
  const applyCalibratedRef = useRef(applyCalibrated)
  applyCalibratedRef.current = applyCalibrated

  useEffect(() => {
    let cancelled = false

    const installCalibrator = (calibrator: BlendshapeCalibrator) => {
      if (cancelled) return

      calibratorRef.current = calibrator
      const categories = activeFrameRef.current?.categories

      if (!categories) return

      applyCalibratedRef.current(calibrator.apply(categories))
    }

    // The exported takes contain raw MediaPipe scores. Recreate the recording harness's 60-frame
    // neutral calibration from the opening of the neutral idle take, then use the exact same
    // normalization/exaggeration/smoothing pipeline for every answer and idle frame.
    loadClip(IDLE_CLIP_ID)
      .then((frames) => {
        installCalibrator(createBlendshapeCalibrator(buildCalibrationBaseline(frames)))
      })
      .catch((calibrationError) => {
        console.warn('ClipAvatar calibration failed; using raw blendshape scores.', calibrationError)
        installCalibrator(createBlendshapeCalibrator({}))
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) return

    if (import.meta.env.DEV) installShotHelper()

    const realistic = renderMode === 'realistic'
    let cancelled = false
    let frameId: number | null = null
    // Declared outside the try so cleanup can still dispose whatever got created before a
    // mid-setup failure (e.g. WebGLRenderer construction can throw if the browser refuses a
    // context — out of contexts, GPU denylisted, etc).
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let avatarRoot: THREE.Group | null = null
    let avatarVisualController: AvatarVisualController | null = null
    let stage: AvatarStage | null = null
    let post: AvatarPostProcessing | null = null
    let postFailed = !realistic
    let modelLoaded = false
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let removeResizeListener: (() => void) | null = null
    let retryTimer: number | null = null

    // Ready once the model is in the scene and (realistic mode) the lazily loaded post pipeline has
    // arrived or failed, so the first visible frame is never an unfiltered one.
    const maybeReady = () => {
      if (cancelled || !modelLoaded || (!post && !postFailed)) return
      setReady(true)
      onReadyRef.current?.()
    }

    try {
      setError(null)
      scene = new THREE.Scene()
      // Treat the face as the main subject. The intentionally tight head-and-shoulders framing
      // leaves the lower torso outside the shot, while the extra-wide canvas preserves useful
      // horizontal room without pulling the camera away from the avatar.
      const camera = new THREE.PerspectiveCamera(BASE_CAMERA_FOV, 1, 0.1, 100)
      // Pan the framing downward without changing the camera distance or FOV. This shifts the
      // avatar upward in the finished shot and leaves room for low hand gestures at the bottom.
      camera.position.copy(BASE_CAMERA_POSITION)
      camera.lookAt(BASE_CAMERA_LOOKAT)
      camera.layers.enable(1)
      camera.layers.enable(HUD_LAYER)
      camera.layers.enable(3)

      renderer = realistic
        ? new THREE.WebGLRenderer({
            canvas,
            // MSAA happens in the HDR scene target instead; a multisampled canvas would be wasted.
            antialias: false,
            alpha: true,
            premultipliedAlpha: true,
            powerPreference: 'high-performance',
          })
        : new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setClearColor(0x000000, 0)
      // Stats cover the whole frame (scene + post passes), reset once per rendered frame below.
      renderer.info.autoReset = false

      // `?dpr=2` (dev only) simulates a high-density display for performance testing.
      const devicePixelRatio = (import.meta.env.DEV && Number(new URLSearchParams(window.location.search).get('dpr')))
        || window.devicePixelRatio
        || 1
      let adaptive: AdaptiveQualityController | null = null
      let tierId: QualityTierId = 'high'

      if (realistic) {
        tierId = selectInitialTier({
          devicePixelRatio,
          isMobile: detectMobile(),
          hardwareConcurrency: navigator.hardwareConcurrency,
          gpuRenderer: readGpuRenderer(renderer),
          override: readQualityOverride(),
        })
        adaptive = readQualityOverride() ? null : createAdaptiveQuality(tierId, performance.now())
        renderer.setPixelRatio(effectivePixelRatio(QUALITY_TIERS[tierId], devicePixelRatio))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.toneMapping = REALISTIC_TONE_MAPPING
        renderer.toneMappingExposure = REALISTIC_EXPOSURE
        stage = setupRealisticStage(renderer, scene, QUALITY_TIERS[tierId])
      } else {
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.35
        stage = setupLegacyStage(scene)
      }

      let fullWidth = 1
      let fullHeight = 1
      const cropPlanner = createRenderCropPlanner({ fallbackAspect: RENDER_CROP_FALLBACK_ASPECT })
      let appliedCrop: RenderCrop | null = null
      let extentProbe: AvatarExtentProbe | null = null

      if (realistic) {
        // The canvas box is positioned here, in the same task that resizes the drawing buffer and
        // offsets the projection, never through React state: a state update commits a frame or
        // more later, and in between the new buffer is shown stretched into the old box.
        Object.assign(canvas.style, { position: 'absolute', top: '0px', height: '100%' })
      }

      // Applies a crop to the renderer, the projection, the post targets and the canvas box.
      const applyCrop = (crop: RenderCrop, force = false) => {
        if (!renderer) return
        if (!force && appliedCrop && appliedCrop.x === crop.x && appliedCrop.width === crop.width) return
        appliedCrop = crop
        camera.setViewOffset(fullWidth, fullHeight, crop.x, 0, crop.width, fullHeight)
        camera.updateProjectionMatrix()
        renderer.setSize(crop.width, fullHeight, false)
        post?.setSize(
          renderer.domElement.width,
          renderer.domElement.height,
          { offsetX: crop.x, fullWidth, fullHeight },
        )
        canvas.style.left = `${crop.x}px`
        canvas.style.width = `${crop.width}px`
      }

      // Re-plans the crop around the avatar as posed and framed right now. Call after the camera
      // and pose for the frame are final and before drawing.
      const updateCrop = (now: number, force = false) => {
        if (!realistic) return
        let extent = null
        if (extentProbe && avatarRoot) {
          camera.updateMatrixWorld()
          avatarRoot.updateMatrixWorld(true)
          extent = measureAvatarExtent(extentProbe, camera, fullWidth, fullHeight)
        }
        applyCrop(cropPlanner.update(fullWidth, fullHeight, extent, now), force)
      }

      const resizeRenderer = () => {
        if (!renderer) return

        fullWidth = Math.max(1, Math.round(container.clientWidth || 320))
        fullHeight = Math.max(1, Math.round(container.clientHeight || 240))
        camera.aspect = fullWidth / fullHeight

        if (realistic) {
          updateCrop(performance.now(), true)
        } else {
          camera.clearViewOffset()
          renderer.setSize(fullWidth, fullHeight, false)
        }

        camera.updateProjectionMatrix()
      }

      resizeRenderer()

      // Resizing a canvas clears its drawing buffer, and ResizeObserver callbacks run after this
      // frame's requestAnimationFrame callbacks but before paint. Without an immediate redraw,
      // every resize (window resize, the dock's 700 ms size transition) paints an empty canvas.
      let redrawAfterResize: (() => void) | null = null
      const handleResize = () => {
        resizeRenderer()
        redrawAfterResize?.()
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(container)
      } else {
        window.addEventListener('resize', handleResize)
        removeResizeListener = () => window.removeEventListener('resize', handleResize)
      }

      const applyTier = (nextTier: QualityTierId) => {
        if (!renderer) return
        tierId = nextTier
        const tier = QUALITY_TIERS[nextTier]
        renderer.setPixelRatio(effectivePixelRatio(tier, devicePixelRatio))
        stage?.applyTier?.(tier)
        post?.setTier(tier)
        resizeRenderer()
      }

      if (realistic) {
        import('./avatarPostProcessing')
          .then(({ createAvatarPostProcessing }) => {
            if (cancelled || !renderer || !scene) return
            post = createAvatarPostProcessing({
              renderer,
              scene,
              camera,
              tier: QUALITY_TIERS[tierId],
              toneMapping: REALISTIC_TONE_MAPPING,
            })
            resizeRenderer()
            maybeReady()
          })
          .catch((postError) => {
            if (cancelled) return
            console.warn('ClipAvatar post-processing failed to load; rendering directly.', postError)
            postFailed = true
            // Without the MSAA target, alpha-to-coverage hair would render as solid cards.
            avatarRoot?.traverse((object) => {
              const material = (object as THREE.Mesh).material as THREE.Material | undefined
              if (material && !Array.isArray(material) && material.alphaToCoverage) {
                material.alphaToCoverage = false
                material.alphaHash = true
                material.needsUpdate = true
              }
            })
            maybeReady()
          })
      }

      new GLTFLoader().load(
        AVATAR_URL,
        (gltf) => {
          if (cancelled) {
            disposeAvatar(gltf.scene)
            return
          }

          avatarRoot = gltf.scene
          const morphMeshes: THREE.Mesh[] = []

          avatarRoot.traverse((object) => {
            const mesh = object as THREE.Mesh

            if (!mesh.isMesh) return

            if (mesh.morphTargetDictionary) morphMeshes.push(mesh)

            const skinnedMesh = mesh as THREE.SkinnedMesh
            if (skinnedMesh.isSkinnedMesh) skinnedMesh.frustumCulled = false
          })

          if (morphMeshes.length === 0) {
            disposeAvatar(avatarRoot)
            avatarRoot = null
            setError('The avatar model has no facial morph targets.')
            return
          }

          // The source GLB is authored in a T-pose. Reuse the recording harness's neutral-pose
          // adjustment so the HUD shows a natural bust instead of horizontal arms.
          avatarVisualController = realistic
            ? applyAvatarVisualTreatment(avatarRoot)
            : applyLegacyAvatarVisualTreatment(avatarRoot)
          visualControllerRef.current = avatarVisualController

          if (realistic) {
            // Hair cards and corneas render normally but stay out of the AO depth/normal buffer.
            avatarRoot.traverse((object) => {
              if (/haircut|cornea/i.test(object.name)) object.layers.set(3)
            })
            if (postFailed) {
              avatarRoot.traverse((object) => {
                const material = (object as THREE.Mesh).material as THREE.Material | undefined
                if (material && !Array.isArray(material) && material.alphaToCoverage) {
                  material.alphaToCoverage = false
                  material.alphaHash = true
                }
              })
            }
          }

          relaxAvatarArms(avatarRoot)
          if (realistic) extentProbe = createAvatarExtentProbe(avatarRoot)
          avatarRootRef.current = avatarRoot
          poseBoneRegistryRef.current = createPoseBoneRegistry(avatarRoot)
          scene?.add(avatarRoot)
          morphMeshesRef.current = morphMeshes

          if (latestCalibratedCategoriesRef.current) {
            applyBlendshapesToMeshes(latestCalibratedCategoriesRef.current, morphMeshes)
            avatarVisualController.setBlendshapes?.(latestCalibratedCategoriesRef.current)
          }

          if (latestPoseRef.current) {
            applyRecordedPose(latestPoseRef.current, avatarRoot, poseBoneRegistryRef.current)
          }

          modelLoaded = true
          if (import.meta.env.DEV && container.clientWidth > 600) publishDebugGlobals()
          maybeReady()
        },
        undefined,
        (loadError) => {
          if (cancelled) return
          setError(loadError instanceof Error ? loadError.message : 'The avatar model failed to load.')
          console.error('ClipAvatar model failed to load:', loadError)
        },
      )

      const renderScene = scene
      const renderer_ = renderer
      const hudPosition = new THREE.Vector3()

      let lastRenderTime = 0
      let lastFrameTime = 0
      let canvasOnScreen = true
      let canvasVisible = true
      let visibilityCheckCountdown = 0
      let pendingTier: QualityTierId | null = null

      if (typeof IntersectionObserver !== 'undefined') {
        intersectionObserver = new IntersectionObserver((entries) => {
          canvasOnScreen = entries.some((entry) => entry.isIntersecting)
        })
        intersectionObserver.observe(container)
      }

      const drawFrame = (now: number) => {
        if (realistic) {
          if (post) {
            const hud = avatarVisualController?.hud
            if (hud) hud.ring.getWorldPosition(hudPosition)
            post.render(now, hud ? { position: hudPosition, brightness: hud.brightness } : null)
          } else if (postFailed) {
            renderer_.render(renderScene, camera)
          }
        } else {
          renderer_.render(renderScene, camera)
        }
      }

      // Dev-only handles for the hero avatar (the project-card preview is ≤ 600 px wide).
      const publishDebugGlobals = () => {
        const globals = window as unknown as Record<string, unknown>
        globals.__avatarRenderer = renderer_
        globals.__avatarScene = renderScene
        globals.__avatarCamera = camera
        globals.__avatarBench = bench
      }

      let bench: unknown = null
      if (import.meta.env.DEV) {
        // window.__avatarBench(60): renders frames back to back, forcing GPU completion with a
        // 1px readback each time, and reports the mean/p95 wall time per frame. Works even when
        // the tab's rAF is throttled, so tiers can be compared without the window in focus.
        bench = async (
          frames = 60,
          overrides: Partial<(typeof QUALITY_TIERS)[QualityTierId]> = {},
        ) => {
          if (container.clientWidth <= 600) return null
          const hasOverrides = Object.keys(overrides).length > 0
          if (hasOverrides) post?.setTier({ ...QUALITY_TIERS[tierId], ...overrides })
          const gl = renderer_.getContext()
          const pixel = new Uint8Array(4)
          const times: number[] = []
          const gpuTimes: number[] = []
          for (let index = 0; index < frames + 5; index += 1) {
            const start = performance.now()
            drawFrame(start)
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
            if (index >= 5) times.push(performance.now() - start)
            await new Promise((resolve) => setTimeout(resolve, 0))
            if (index >= 8 && post?.gpuMs) gpuTimes.push(post.gpuMs)
          }
          if (hasOverrides) post?.setTier(QUALITY_TIERS[tierId])
          times.sort((a, b) => a - b)
          const mean = times.reduce((sum, value) => sum + value, 0) / times.length
          return {
            tier: tierId,
            pixelRatio: renderer_.getPixelRatio(),
            drawingBuffer: [renderer_.domElement.width, renderer_.domElement.height],
            meanMs: Math.round(mean * 100) / 100,
            p95Ms: Math.round(times[Math.floor(times.length * 0.95)] * 100) / 100,
            gpuMeanMs: gpuTimes.length
              ? Math.round((gpuTimes.reduce((sum, value) => sum + value, 0) / gpuTimes.length) * 100) / 100
              : null,
          }
        }
      }

      const animate = (now: number) => {
        if (cancelled) return
        frameId = requestAnimationFrame(animate)

        // Skip all GPU work while the avatar cannot be seen: scrolled off-screen (the project card
        // preview) or faded out (the persistent assistant is kept mounted at opacity 0).
        visibilityCheckCountdown -= 1
        if (visibilityCheckCountdown <= 0) {
          const checkVisibility = (canvas as HTMLCanvasElement & {
            checkVisibility?: (options?: Record<string, boolean>) => boolean
          }).checkVisibility
          canvasVisible = checkVisibility
            ? checkVisibility.call(canvas, { opacityProperty: true, visibilityProperty: true })
            : true
          // While hidden, re-check every frame so the first frame after a reveal is never stale.
          visibilityCheckCountdown = canvasVisible ? 20 : 1
        }
        if (!canvasOnScreen || !canvasVisible) {
          lastFrameTime = 0
          return
        }

        const debug = import.meta.env.DEV ? readAvatarDebug() : undefined

        // Adaptive quality looks at every rAF interval (not just rendered frames): if the GPU
        // cannot keep up, the browser delivers callbacks late regardless of the FPS cap. The
        // switch itself waits for the next rendered frame: changing the pixel ratio resizes (and
        // clears) the canvas, so on a frame the FPS cap skips it would paint an empty canvas.
        if (realistic && lastFrameTime > 0 && modelLoaded && post) {
          if (debug?.tier && debug.tier !== tierId) {
            pendingTier = debug.tier
          } else if (!debug?.tier && adaptive) {
            const nextTier = adaptive.sample(now - lastFrameTime, now, 1000 / targetFpsRef.current, post.gpuMs)
            if (nextTier) pendingTier = nextTier
          }
        }
        lastFrameTime = now

        const frameInterval = 1000 / targetFpsRef.current
        const elapsed = now - lastRenderTime

        if (lastRenderTime > 0 && elapsed + 0.5 < frameInterval) return

        const dt = lastRenderTime > 0 ? elapsed : 16
        lastRenderTime = now - (elapsed % frameInterval)
        // Rotation is driven entirely by scroll (scrollRotation.ts) — this
        // loop just samples whatever the ref currently holds every frame.
        // Rendering is rate-limited by the user's HUD setting while the latest
        // prerecorded pose and blendshapes continue updating independently.
        if (avatarRoot) avatarRoot.rotation.y = debug?.rotation ?? rotationRef.current
        if (debug?.pose && avatarRoot) applyRecordedPose(debug.pose, avatarRoot, poseBoneRegistryRef.current)

        // Ease toward a closer, tighter framing while a personal-moment answer plays, and back
        // out to the base shot otherwise — smoothed so the dolly never snaps.
        const targetCloseness = (debug?.personalMoment ?? personalMomentRef.current) ? 1 : 0
        closenessRef.current += (targetCloseness - closenessRef.current)
          * Math.min(1, CLOSENESS_EASE_PER_MS * dt)

        // Small always-on sway independent of scroll/dolly, so the avatar reads as alive and
        // restless rather than perfectly locked-off even when idling.
        const t = now / 1000
        const idleSwayX = Math.sin(t * 0.35) * IDLE_DRIFT_POSITION
        const idleSwayY = Math.sin(t * 0.5 + 1.3) * IDLE_DRIFT_POSITION * 0.6
        const idleLookX = Math.sin(t * 0.22 + 0.7) * IDLE_DRIFT_LOOK
        const idleLookY = Math.cos(t * 0.31) * IDLE_DRIFT_LOOK * 0.5

        camera.position.set(
          BASE_CAMERA_POSITION.x + idleSwayX,
          BASE_CAMERA_POSITION.y + idleSwayY,
          BASE_CAMERA_POSITION.z - closenessRef.current * PERSONAL_MOMENT_DOLLY,
        )
        camera.fov = BASE_CAMERA_FOV - closenessRef.current * PERSONAL_MOMENT_FOV_DELTA
        camera.updateProjectionMatrix()
        camera.lookAt(
          BASE_CAMERA_LOOKAT.x + idleLookX,
          BASE_CAMERA_LOOKAT.y + idleLookY,
          BASE_CAMERA_LOOKAT.z,
        )
        if (debug?.blendshapes) {
          const forced = Object.entries(debug.blendshapes).map(([categoryName, score]) => ({ categoryName, score }))
          const merged = [
            ...(latestCalibratedCategoriesRef.current ?? []).filter(({ categoryName }) => !(categoryName in debug.blendshapes!)),
            ...forced,
          ]
          applyBlendshapesToMeshes(merged, morphMeshesRef.current)
          avatarVisualController?.setBlendshapes?.(merged)
        }

        avatarVisualController?.update(
          now,
          jawOpenAmountRef.current,
          debug?.critical ?? criticalRef.current,
          debug?.yellowHud ?? yellowHudRef.current,
        )

        if (pendingTier && pendingTier !== tierId) applyTier(pendingTier)
        pendingTier = null
        updateCrop(now)

        renderer_.info.reset()

        if (realistic) {
          if (debug?.toneMapping || debug?.exposure !== undefined) {
            const toneMapping = TONE_MAPPINGS[debug.toneMapping ?? 'neutral']
            if (renderer_.toneMapping !== toneMapping) {
              renderer_.toneMapping = toneMapping
              post?.setToneMapping(toneMapping)
            }
            renderer_.toneMappingExposure = debug.exposure ?? REALISTIC_EXPOSURE
          }
        }

        drawFrame(now)

        if (import.meta.env.DEV) {
          if (container.clientWidth > 600) publishDebugGlobals()
          ;(window as unknown as { __avatarStats?: unknown }).__avatarStats = {
            mode: renderMode,
            tier: tierId,
            smoothedFrameMs: adaptive?.smoothedFrameMs ?? null,
            smoothedGpuMs: adaptive?.smoothedGpuMs ?? post?.gpuMs ?? null,
            pixelRatio: renderer_.getPixelRatio(),
            drawingBuffer: [renderer_.domElement.width, renderer_.domElement.height],
            calls: renderer_.info.render.calls,
            triangles: renderer_.info.render.triangles,
          }
        }

        if (debug?.capture && (debug.capture.small ? canvas.clientWidth <= 600 : canvas.clientWidth > 600)) {
          captureAvatarCrop(canvas, camera, poseBoneRegistryRef.current.head ?? null, debug.capture)
          debug.capture = undefined
        }
      }

      redrawAfterResize = () => {
        if (cancelled || !modelLoaded || !canvasOnScreen || !canvasVisible) return
        if (realistic && !post && !postFailed) return
        drawFrame(performance.now())
      }

      frameId = requestAnimationFrame(animate)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The 3D avatar failed to start.'

      setError(message)
      console.error('ClipAvatar renderer failed to initialize:', err)

      if (rendererAttempt < RENDERER_RETRY_LIMIT) {
        retryTimer = window.setTimeout(() => {
          setRendererAttempt((attempt) => attempt + 1)
        }, 250 * (rendererAttempt + 1))
      }
    }

    return () => {
      cancelled = true
      setReady(false)
      morphMeshesRef.current = []
      avatarRootRef.current = null
      poseBoneRegistryRef.current = {}
      visualControllerRef.current = null

      if (frameId !== null) cancelAnimationFrame(frameId)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      removeResizeListener?.()

      if (import.meta.env.DEV) {
        const debugGlobals = window as unknown as Record<string, unknown>
        if (debugGlobals.__avatarRenderer === renderer) {
          delete debugGlobals.__avatarRenderer
          delete debugGlobals.__avatarScene
          delete debugGlobals.__avatarCamera
          delete debugGlobals.__avatarBench
        }
      }

      post?.dispose()
      post = null
      avatarVisualController?.dispose?.()
      if (avatarRoot) disposeAvatar(avatarRoot)
      stage?.dispose()
      scene?.clear()
      renderer?.dispose()
      // Do not force-loss the canvas context here. React StrictMode deliberately runs an
      // effect setup/cleanup/setup cycle in development; losing the context during the first
      // cleanup makes the second renderer fail against the still-mounted canvas. dispose()
      // releases Three.js resources, and the browser releases the context when the canvas is
      // actually removed.
    }
  }, [rendererAttempt, rotationRef, renderMode])

  useEffect(() => {
    if (!activeFrame) return

    const calibrated = calibratorRef.current?.apply(activeFrame.categories)

    if (calibrated) applyCalibratedRef.current(calibrated)

    if (activeFrame.pose) {
      latestPoseRef.current = activeFrame.pose

      if (avatarRootRef.current) {
        applyRecordedPose(activeFrame.pose, avatarRootRef.current, poseBoneRegistryRef.current)
      }
    }
  }, [activeFrame])

  // Realistic mode positions and sizes the canvas imperatively alongside the render crop (see
  // applyCrop); React only toggles visibility so it never overwrites those properties.
  const canvasStyle: CSSProperties = { display: ready ? 'block' : 'none' }

  return (
    <div className="clip-avatar" ref={containerRef}>
      <canvas
        key={rendererAttempt}
        ref={canvasRef}
        className="clip-avatar-canvas"
        style={canvasStyle}
      />
      {!ready && (
        <div
          className={`clip-avatar-placeholder${error ? ' is-fallback' : ''}`}
          data-avatar-error={error ?? undefined}
          role={error ? 'img' : 'status'}
          aria-label={error ? 'Avatar preview' : undefined}
        >
          {error ? (
            <span className="clip-avatar-fallback-model" aria-hidden="true" />
          ) : (
            <span>Avatar loading…</span>
          )}
        </div>
      )}
    </div>
  )
}
