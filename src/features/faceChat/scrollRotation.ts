import { useEffect, useRef } from 'react'

// Scrolling down accumulates positive rotation. Flip to -1 in one place if
// the direction reads as backwards once viewed with real WebGL (this repo's
// preview environment can't render the canvas, so direction is unverified).
const ROTATION_DIRECTION = 1

// One full viewport-height of accumulated scroll delta = one full turn.
// Each section is exactly one viewport tall (App.css's .section-page),
// so this reads as "roughly 360° across the scroll distance between
// major sections."
const RADIANS_PER_VIEWPORT = 2 * Math.PI

// Ignore discontinuities such as browser scroll restoration or layout corrections. Real
// user-driven deltas arrive across animation frames and remain well below this threshold.
export function computeRotationDelta(
  prevScrollTop: number,
  nextScrollTop: number,
  viewportHeight: number,
  maxJumpFraction = 0.5,
): number {
  const rawDelta = nextScrollTop - prevScrollTop

  if (viewportHeight <= 0) return 0
  if (Math.abs(rawDelta) >= maxJumpFraction * viewportHeight) return 0

  return ROTATION_DIRECTION * rawDelta * (RADIANS_PER_VIEWPORT / viewportHeight)
}

// Unbounded, never-modulo'd running total in radians, driven by real movement on App.tsx's
// single scrollable container. Three.js rotation is periodic, so it does not need manual wraps.
export function useScrollRotation() {
  const rotationRef = useRef(0)

  useEffect(() => {
    const scrollStage = document.querySelector<HTMLElement>('.scroll-stage')

    if (!scrollStage) return

    let prevScrollTop = scrollStage.scrollTop

    const handleScroll = () => {
      const nextScrollTop = scrollStage.scrollTop

      rotationRef.current += computeRotationDelta(
        prevScrollTop,
        nextScrollTop,
        scrollStage.clientHeight,
      )
      prevScrollTop = nextScrollTop
    }

    scrollStage.addEventListener('scroll', handleScroll, { passive: true })

    return () => scrollStage.removeEventListener('scroll', handleScroll)
  }, [])

  return rotationRef
}
