import { useClipPlayer } from '../../features/faceChat/clipPlayback'
import ClipAvatar from '../../features/faceChat/ClipAvatar'

// Reuses one of the face-tracking avatar's recorded idle clips as a silent, looping preview
// image for its own project card, instead of a static screenshot.
const PREVIEW_CLIP_ID = 'idle_0'

export default function ProjectCardAvatarPreview() {
  const { activeFrame } = useClipPlayer(PREVIEW_CLIP_ID, 'loop', true, { audioEnabled: false })

  return (
    <div className="project-card-image project-card-avatar-preview" aria-hidden="true">
      <ClipAvatar activeFrame={activeFrame} />
    </div>
  )
}
