import { useEffect, useRef } from 'react'
import './NodeField.css'

interface NodeFieldProps {
  className?: string
}

interface FieldNode {
  x: number
  y: number
  vx: number
  vy: number
}

const NODE_AREA_PER_NODE = 15000
const MIN_NODES = 34
const MAX_NODES = 85
const LINK_DISTANCE = 130
const POINTER_RADIUS = 160
const POINTER_FORCE = 0.85
const DRIFT_JITTER = 0.012
const MAX_SPEED = 0.35
const FRICTION = 0.96

// Ambient node network behind the centered avatar. Nodes drift on their own and
// scatter away from the cursor as it passes through them, like a disturbed sensor mesh.
export default function NodeField({ className }: NodeFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement

    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let nodes: FieldNode[] = []
    let frameId = 0
    const pointer = { x: -9999, y: -9999 }

    const seedNodes = () => {
      const count = Math.round(
        Math.min(MAX_NODES, Math.max(MIN_NODES, (width * height) / NODE_AREA_PER_NODE)),
      )

      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
      }))
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seedNodes()
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()

      pointer.x = event.clientX - rect.left
      pointer.y = event.clientY - rect.top
    }

    const step = () => {
      for (const node of nodes) {
        const dx = node.x - pointer.x
        const dy = node.y - pointer.y
        const dist = Math.hypot(dx, dy)

        if (dist < POINTER_RADIUS && dist > 0.01) {
          const force = (1 - dist / POINTER_RADIUS) * POINTER_FORCE
          node.vx += (dx / dist) * force
          node.vy += (dy / dist) * force
        }

        node.vx += (Math.random() - 0.5) * DRIFT_JITTER
        node.vy += (Math.random() - 0.5) * DRIFT_JITTER
        node.vx *= FRICTION
        node.vy *= FRICTION

        const speed = Math.hypot(node.vx, node.vy)

        if (speed > MAX_SPEED) {
          node.vx = (node.vx / speed) * MAX_SPEED
          node.vy = (node.vy / speed) * MAX_SPEED
        }

        node.x += node.vx
        node.y += node.vy

        if (node.x < 0) { node.x = 0; node.vx = Math.abs(node.vx) }
        if (node.x > width) { node.x = width; node.vx = -Math.abs(node.vx) }
        if (node.y < 0) { node.y = 0; node.vy = Math.abs(node.vy) }
        if (node.y > height) { node.y = height; node.vy = -Math.abs(node.vy) }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]
          const b = nodes[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)

          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - dist / LINK_DISTANCE) * 0.2})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 1.7, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
        ctx.fill()
      }
    }

    const loop = () => {
      step()
      draw()
      frameId = window.requestAnimationFrame(loop)
    }

    const resizeObserver = new ResizeObserver(resize)

    resizeObserver.observe(container)
    resize()
    window.addEventListener('pointermove', handlePointerMove)

    if (prefersReducedMotion) {
      draw()
    } else {
      frameId = window.requestAnimationFrame(loop)
    }

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)

      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <div className={`node-field${className ? ` ${className}` : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} className="node-field-canvas" />
    </div>
  )
}
