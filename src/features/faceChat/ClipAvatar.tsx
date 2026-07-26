import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { applyBlendshapesToMeshes } from './clipPlayback'
import './ClipAvatar.css'

interface ClipAvatarProps {
  // Per-frame blendshape categories from a clip player (see clipPlayback.ts). Applied to any
  // mesh in the scene with morph targets — a no-op today since the placeholder sphere below has
  // none, but this is the hookup point for once a real morph-target avatar replaces it.
  activeCategories?: { categoryName: string; score: number }[] | null
}

// Camera-free Three.js avatar surface for prerecorded clip playback (dialogueGraph.ts /
// clipPlayback.ts). Unlike FaceTrackingAvatar (the live webcam-tracking component), this never
// calls getUserMedia and never needs camera permission — it only renders whatever blendshape
// frames a clip player hands it.
export default function ClipAvatar({ activeCategories }: ClipAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const morphMeshesRef = useRef<THREE.Mesh[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    let cancelled = false
    let frameId: number | null = null
    // Declared outside the try so cleanup can still dispose whatever got created before a
    // mid-setup failure (e.g. WebGLRenderer construction can throw if the browser refuses a
    // context — out of contexts, GPU denylisted, etc).
    let renderer: THREE.WebGLRenderer | null = null
    let geometry: THREE.BufferGeometry | null = null
    let material: THREE.Material | null = null
    let scene: THREE.Scene | null = null

    try {
      scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      camera.position.z = 3

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 240, false)

      geometry = new THREE.SphereGeometry(1, 32, 32)
      material = new THREE.MeshStandardMaterial({ color: 0x4c8bf5 })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)
      morphMeshesRef.current = [mesh]

      const light = new THREE.DirectionalLight(0xffffff, 1)
      light.position.set(2, 2, 2)
      scene.add(light)

      const renderScene = scene
      const renderer_ = renderer

      const animate = () => {
        if (cancelled) return
        mesh.rotation.y += 0.01
        renderer_.render(renderScene, camera)
        frameId = requestAnimationFrame(animate)
      }

      animate()
      setReady(true)
    } catch (err) {
      // WebGL isn't guaranteed to be available (context limits, a denylisted GPU, a headless
      // test environment) — fail into a visible placeholder instead of throwing during render,
      // which would otherwise take the whole widget tree down with no error boundary.
      setError(err instanceof Error ? err.message : 'The 3D avatar failed to start.')
    }

    return () => {
      cancelled = true
      setReady(false)
      morphMeshesRef.current = []

      if (frameId !== null) cancelAnimationFrame(frameId)

      geometry?.dispose()
      material?.dispose()
      scene?.clear()
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  }, [])

  useEffect(() => {
    if (!activeCategories) return
    applyBlendshapesToMeshes(activeCategories, morphMeshesRef.current)
  }, [activeCategories])

  return (
    <div className="clip-avatar">
      <canvas ref={canvasRef} className="clip-avatar-canvas" style={{ display: ready ? 'block' : 'none' }} />
      {!ready && (
        <div className="clip-avatar-placeholder">
          <span>{error ? '3D avatar unavailable here' : 'Avatar loading…'}</span>
        </div>
      )}
    </div>
  )
}
