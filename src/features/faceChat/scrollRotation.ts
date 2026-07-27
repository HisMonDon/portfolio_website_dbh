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

// The 3-wide section-window virtualization in App.tsx means scrollTop isn't
// a simple ever-increasing value: sliding the window drops a full
// viewport-height section from above the viewport, and the browser's scroll
// anchoring silently re-adjusts scrollTop by ~one clientHeight to keep the
// view visually stable. That anchoring correction lands in a single scroll
// event as a jump of ~100% of viewportHeight; real user-driven deltas (even
// fast flings, since 'scroll' fires on essentially every frame of a
// gesture) stay well under that. maxJumpFraction rejects the former while
// passing the latter.
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

// Unbounded, never-modulo'd running total in radians, driven by real scroll
// movement on .scroll-stage (App.tsx's single scrollable container). Never
// wrapping the value is what makes the About<->Credits loop feel continuous
// with no snap: section order is already cyclic (sectionConfig.ts), and
// Three.js's rotation.y is periodic by nature, so the visual result loops on
// its own without this hook doing anything special at the boundary.
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
