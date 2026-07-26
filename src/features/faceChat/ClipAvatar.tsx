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

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    let cancelled = false
    let frameId: number | null = null

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 240, false)

    const geometry = new THREE.SphereGeometry(1, 32, 32)
    const material = new THREE.MeshStandardMaterial({ color: 0x4c8bf5 })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    morphMeshesRef.current = [mesh]

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(2, 2, 2)
    scene.add(light)

    const animate = () => {
      if (cancelled) return
      mesh.rotation.y += 0.01
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(animate)
    }

    animate()
    setReady(true)

    return () => {
      cancelled = true
      setReady(false)
      morphMeshesRef.current = []

      if (frameId !== null) cancelAnimationFrame(frameId)

      geometry.dispose()
      material.dispose()
      scene.clear()
      renderer.dispose()
      renderer.forceContextLoss()
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
          <span>Avatar loading…</span>
        </div>
      )}
    </div>
  )
}
