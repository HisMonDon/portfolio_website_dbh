import { lazy, Suspense } from 'react'
import type { SectionId } from './NavBar'
import './PersistentAssistant.css'

const FaceChatWidget = lazy(() => import('../features/faceChat/FaceChatWidget'))

interface PersistentAssistantProps {
  visible: boolean
  activeSection: SectionId
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
}: PersistentAssistantProps) {
  const centered = activeSection === 'about'

  return (
    <div
      className={`persistent-assistant${visible ? ' is-visible' : ''}${centered ? ' is-centered' : ''}`}
      data-active-section={activeSection}
      aria-hidden={!visible}
    >
      <Suspense fallback={null}>
        <FaceChatWidget centered={centered} activeSection={activeSection} />
      </Suspense>
    </div>
  )
}
