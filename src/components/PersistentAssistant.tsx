import { lazy, Suspense, useEffect, useState } from 'react'
import type { SectionId } from './NavBar'
import './PersistentAssistant.css'

const FaceChatWidget = lazy(() => import('../features/faceChat/FaceChatWidget'))
const INTERFACE_FADE_OUT_MS = 220

interface PersistentAssistantProps {
  visible: boolean
  activeSection: SectionId
  isMuted: boolean
  onMutedChange: (isMuted: boolean) => void
  revealReady?: boolean
}

// Site-wide dock for the face-chat assistant (desktop only — see useIsMobile
// at the call site in App.tsx). Stays mounted continuously once rendered so
// the avatar's WebGL context, idle animation, and dialogue state survive
// section changes; only opacity/visibility/pointer-events toggle, following
// the same fixed-dock + .is-visible fade pattern as Projects.css's
// .project-preview aside.
export default function PersistentAssistant({
  visible,
  activeSection,
  isMuted,
  onMutedChange,
  revealReady = true,
}: PersistentAssistantProps) {
  const shouldCenter = activeSection === 'about'
  const [centered, setCentered] = useState(shouldCenter)

  useEffect(() => {
    const moveAssistant = window.setTimeout(() => {
      setCentered(shouldCenter)
    }, INTERFACE_FADE_OUT_MS)

    return () => window.clearTimeout(moveAssistant)
  }, [shouldCenter])

  return (
    <div
      className={`persistent-assistant${visible ? ' is-visible' : ''}${centered ? ' is-centered' : ''}`}
      data-active-section={activeSection}
      aria-hidden={!visible}
    >
      <Suspense fallback={null}>
        <FaceChatWidget
          centered={shouldCenter}
          activeSection={activeSection}
          isMuted={isMuted}
          onMutedChange={onMutedChange}
          revealReady={revealReady}
        />
      </Suspense>
    </div>
  )
}
