import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './FaceTrackingAvatar.css'

interface FaceTrackingAvatarProps {
  // Controlled from outside so the permission gate / stop button can drive it.
  started: boolean
  onError?: (message: string) => void
}

// Wraps the camera + Three.js engine. Renders a placeholder box until
// `started` is true; only then does it request the camera stream and spin
// up the WebGL scene. Everything created in the effect is torn down in the
// effect's cleanup, so StrictMode's mount/unmount/mount in dev, and repeated
// start/stop toggling, never leak MediaStream tracks or WebGL contexts.
export default function FaceTrackingAvatar({ started, onError }: FaceTrackingAvatarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!started) {
      setReady(false)
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let geometry: THREE.BufferGeometry | null = null
    let material: THREE.Material | null = null
    let frameId: number | null = null

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Camera permission was denied.')
        return
      }

      if (cancelled) {
        // Component was stopped/unmounted while awaiting the permission
        // prompt — tear the just-granted stream straight back down.
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Fire-and-forget: some browsers/contexts never resolve or reject
        // this promise (e.g. a backgrounded/non-visible tab), and camera
        // playback isn't a prerequisite for the Three.js scene below.
        videoRef.current.play().catch(() => {
          /* autoplay rejection is non-fatal here */
        })
      }

      const canvas = canvasRef.current

      if (!canvas || cancelled) return

      scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
      camera.position.z = 3

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(canvas.clientWidth || 320, canvas.clientHeight || 240, false)

      geometry = new THREE.SphereGeometry(1, 32, 32)
      material = new THREE.MeshStandardMaterial({ color: 0x4c8bf5 })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      const light = new THREE.DirectionalLight(0xffffff, 1)
      light.position.set(2, 2, 2)
      scene.add(light)

      const animate = () => {
        if (cancelled || !renderer || !scene) return
        mesh.rotation.y += 0.01
        renderer.render(scene, camera)
        frameId = requestAnimationFrame(animate)
      }

      animate()
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      setReady(false)

      if (frameId !== null) cancelAnimationFrame(frameId)

      // Stop every camera track so the browser's capture indicator clears
      // and no MediaStream is left dangling.
      stream?.getTracks().forEach((track) => track.stop())

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      // Dispose Three.js resources in dependency order: mesh-owning
      // materials/geometries, then the scene graph, then the GL context.
      geometry?.dispose()
      material?.dispose()
      scene?.clear()
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  }, [started, onError])

  return (
    <div className="face-tracking-avatar" ref={containerRef}>
      <video ref={videoRef} className="face-tracking-avatar-video" muted playsInline />
      <canvas
        ref={canvasRef}
        className="face-tracking-avatar-canvas"
        style={{ display: started && ready ? 'block' : 'none' }}
      />
      {(!started || !ready) && (
        <div className="face-tracking-avatar-placeholder">
          <span>Your avatar goes here</span>
        </div>
      )}
    </div>
  )
}
