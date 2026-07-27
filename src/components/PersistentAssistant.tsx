import { lazy, Suspense } from 'react'
import './PersistentAssistant.css'

const FaceChatWidget = lazy(() => import('../features/faceChat/FaceChatWidget'))

interface PersistentAssistantProps {
  visible: boolean
  centered: boolean
}

// Site-wide dock for the face-chat assistant (desktop only — see useIsMobile
// at the call site in App.tsx). Stays mounted continuously once rendered so
// the avatar's WebGL context, idle animation, and dialogue state survive
// section changes; only opacity/visibility/pointer-events toggle, following
// the same fixed-dock + .is-visible fade pattern as Projects.css's
// .project-preview aside.
export default function PersistentAssistant({
  visible,
  centered,
}: PersistentAssistantProps) {
  return (
    <div
      className={`persistent-assistant${visible ? ' is-visible' : ''}${centered ? ' is-centered' : ''}`}
      aria-hidden={!visible}
    >
      <Suspense fallback={null}>
        <FaceChatWidget centered={centered} />
      </Suspense>
    </div>
  )
}
