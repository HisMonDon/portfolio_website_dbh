import { useEffect, useRef, useState } from 'react'
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
  type AvatarVisualController,
} from './avatarVisuals'
import type { InternalFrame, RecordedPose } from './clipFormat'
import { applyBlendshapesToMeshes, loadClip } from './clipPlayback'
import { IDLE_CLIP_ID } from './dialogueGraph'
import { useScrollRotation } from './scrollRotation'
import './ClipAvatar.css'

interface ClipAvatarProps {
  // The complete recording frame includes raw face scores plus the calibrated body/head pose.
  activeFrame?: InternalFrame | null
  critical?: boolean
  targetFps?: number
}

const RENDERER_RETRY_LIMIT = 2
const AVATAR_URL = new URL('./assets/avatar.glb', import.meta.url).href

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
  targetFps = 60,
}: ClipAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const morphMeshesRef = useRef<THREE.Mesh[]>([])
  const avatarRootRef = useRef<THREE.Group | null>(null)
  const poseBoneRegistryRef = useRef<PoseBoneRegistry>({})
  const calibratorRef = useRef<BlendshapeCalibrator | null>(null)
  const latestCalibratedCategoriesRef = useRef<BlendshapeCategory[] | null>(null)
  const latestPoseRef = useRef<RecordedPose | null>(null)
  const jawOpenAmountRef = useRef(0)
  const criticalRef = useRef(critical)
  const activeFrameRef = useRef(activeFrame)
  const targetFpsRef = useRef(targetFps)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rendererAttempt, setRendererAttempt] = useState(0)
  const rotationRef = useScrollRotation()

  activeFrameRef.current = activeFrame
  criticalRef.current = critical
  targetFpsRef.current = Math.min(60, Math.max(15, targetFps))

  useEffect(() => {
    let cancelled = false

    const installCalibrator = (calibrator: BlendshapeCalibrator) => {
      if (cancelled) return

      calibratorRef.current = calibrator
      const categories = activeFrameRef.current?.categories

      if (!categories) return

      const calibrated = calibrator.apply(categories)
      latestCalibratedCategoriesRef.current = calibrated
      jawOpenAmountRef.current = calibrated.find(
        ({ categoryName }) => categoryName === 'jawOpen',
      )?.score ?? 0
      applyBlendshapesToMeshes(calibrated, morphMeshesRef.current)
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

    if (!canvas) return

    let cancelled = false
    let frameId: number | null = null
    // Declared outside the try so cleanup can still dispose whatever got created before a
    // mid-setup failure (e.g. WebGLRenderer construction can throw if the browser refuses a
    // context — out of contexts, GPU denylisted, etc).
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let avatarRoot: THREE.Group | null = null
    let avatarVisualController: AvatarVisualController | null = null
    let resizeObserver: ResizeObserver | null = null
    let removeResizeListener: (() => void) | null = null
    let retryTimer: number | null = null

    try {
      setError(null)
      scene = new THREE.Scene()
      // Match the head-and-shoulders framing from face_mapping_sandbox's live-avatar phase.
      // The recording harness uses a much wider full-body camera for arm capture, which makes
      // this HUD avatar tiny and exposes the model's neutral T-pose.
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
      camera.position.set(0, 1.6, 1.2)
      camera.lookAt(0, 1.55, 0)
      camera.layers.enable(1)

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.35

      const resizeRenderer = () => {
        if (!renderer) return

        const width = Math.max(1, Math.round(canvas.clientWidth || 320))
        const height = Math.max(1, Math.round(canvas.clientHeight || 240))

        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height, false)
      }

      resizeRenderer()

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeRenderer)
        resizeObserver.observe(canvas)
      } else {
        window.addEventListener('resize', resizeRenderer)
        removeResizeListener = () => window.removeEventListener('resize', resizeRenderer)
      }

      scene.add(new THREE.HemisphereLight(0xdcecff, 0x293241, 1.3))

      const keyLight = new THREE.DirectionalLight(0xf2f7ff, 2)
      keyLight.position.set(1, 2, 2)
      scene.add(keyLight)

      const fillLight = new THREE.DirectionalLight(0xd7e6ff, 1.2)
      fillLight.position.set(-1.5, 1, 1.5)
      scene.add(fillLight)

      const rimLight = new THREE.DirectionalLight(0x6fe3ff, 1.5)
      rimLight.position.set(-0.5, 2.2, -2)
      rimLight.layers.set(1)
      scene.add(rimLight)

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
          avatarVisualController = applyAvatarVisualTreatment(avatarRoot)
          relaxAvatarArms(avatarRoot)
          avatarRootRef.current = avatarRoot
          poseBoneRegistryRef.current = createPoseBoneRegistry(avatarRoot)
          scene?.add(avatarRoot)
          morphMeshesRef.current = morphMeshes

          if (latestCalibratedCategoriesRef.current) {
            applyBlendshapesToMeshes(latestCalibratedCategoriesRef.current, morphMeshes)
          }

          if (latestPoseRef.current) {
            applyRecordedPose(latestPoseRef.current, avatarRoot, poseBoneRegistryRef.current)
          }

          setReady(true)
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

      let lastRenderTime = 0

      const animate = (now: number) => {
        if (cancelled) return
        frameId = requestAnimationFrame(animate)

        const frameInterval = 1000 / targetFpsRef.current
        const elapsed = now - lastRenderTime

        if (lastRenderTime > 0 && elapsed + 0.5 < frameInterval) return

        lastRenderTime = now - (elapsed % frameInterval)
        // Rotation is driven entirely by scroll (scrollRotation.ts) — this
        // loop just samples whatever the ref currently holds every frame.
        // Rendering is rate-limited by the user's HUD setting while the latest
        // prerecorded pose and blendshapes continue updating independently.
        if (avatarRoot) avatarRoot.rotation.y = rotationRef.current
        avatarVisualController?.update(now, jawOpenAmountRef.current, criticalRef.current)
        renderer_.render(renderScene, camera)
      }

      frameId = requestAnimationFrame(animate)
    } catch (err) {
      // WebGL isn't guaranteed to be available (context limits, a denylisted GPU, a headless
      // test environment) — fail into a visible placeholder instead of throwing during render,
      // which would otherwise take the whole widget tree down with no error boundary.
      const message = err instanceof Error ? err.message : 'The 3D avatar failed to start.'

      setError(message)
      console.error('ClipAvatar renderer failed to initialize:', err)

      // Context creation can fail transiently while a browser is reclaiming an older WebGL
      // context (especially after Fast Refresh). Give it two fresh-canvas setup passes before
      // using the visual fallback below instead of leaving a permanent error label on screen.
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

      if (frameId !== null) cancelAnimationFrame(frameId)
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      resizeObserver?.disconnect()
      removeResizeListener?.()

      if (avatarRoot) disposeAvatar(avatarRoot)
      scene?.clear()
      renderer?.dispose()
      // Do not force-loss the canvas context here. React StrictMode deliberately runs an
      // effect setup/cleanup/setup cycle in development; losing the context during the first
      // cleanup makes the second renderer fail against the still-mounted canvas. dispose()
      // releases Three.js resources, and the browser releases the context when the canvas is
      // actually removed.
    }
  }, [rendererAttempt, rotationRef])

  useEffect(() => {
    if (!activeFrame) return

    const calibrated = calibratorRef.current?.apply(activeFrame.categories)

    if (calibrated) {
      latestCalibratedCategoriesRef.current = calibrated
      jawOpenAmountRef.current = calibrated.find(
        ({ categoryName }) => categoryName === 'jawOpen',
      )?.score ?? 0
      applyBlendshapesToMeshes(calibrated, morphMeshesRef.current)
    }

    if (activeFrame.pose) {
      latestPoseRef.current = activeFrame.pose

      if (avatarRootRef.current) {
        applyRecordedPose(activeFrame.pose, avatarRootRef.current, poseBoneRegistryRef.current)
      }
    }
  }, [activeFrame])

  return (
    <div className="clip-avatar">
      <canvas
        key={rendererAttempt}
        ref={canvasRef}
        className="clip-avatar-canvas"
        style={{ display: ready ? 'block' : 'none' }}
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
