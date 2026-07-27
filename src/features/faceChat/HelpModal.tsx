import { useEffect } from 'react'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

interface HelpStep {
  id: string
  imageIndex: number
  title: string
  body: string
}

const HELP_STEPS: HelpStep[] = [
  {
    id: 'record',
    imageIndex: 1,
    title: '1. Recording',
    body: 'Using a webcam and MediaPipe, I record myself answering each question. MediaPipe reads my facial expressions in real time as a set of blendshape values.',
  },
  {
    id: 'map',
    imageIndex: 2,
    title: '2. Mapping',
    body: 'Those blendshape values are mapped onto a 3D avatar built in Three.js, so the model mirrors my expressions, head movement, and mouth shape frame by frame.',
  },
  {
    id: 'play',
    imageIndex: 3,
    title: '3. Playback',
    body: "The mapped performance is saved as a clip. When you pick a question, that clip replays here — no camera or live tracking is needed on your end.",
  },
]

// Resolved lazily via glob so the modal keeps working (falling back to placeholders) until
// image_1/2/3 and demo.mp4 are actually dropped into src/assets.
const STEP_IMAGE_MODULES = import.meta.glob<string>(
  '../assets/image_{1,2,3}.{png,jpg,jpeg,webp,gif}',
  { eager: true, query: '?url', import: 'default' },
)
const DEMO_VIDEO_MODULES = import.meta.glob<string>(
  '../assets/demo.{mp4,webm,mov}',
  { eager: true, query: '?url', import: 'default' },
)

function getStepImageUrl(imageIndex: number): string | undefined {
  const match = Object.entries(STEP_IMAGE_MODULES).find(
    ([path]) => path.includes(`image_${imageIndex}.`),
  )

  return match?.[1]
}

const demoVideoUrl = Object.values(DEMO_VIDEO_MODULES)[0]

export default function HelpModal({ onClose }: HelpModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="help-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="help-modal-corner is-top-right" aria-hidden="true" />
        <span className="help-modal-corner is-bottom-left" aria-hidden="true" />

        <div className="help-modal-header">
          <div>
            <p className="help-modal-kicker">How this avatar works</p>
            <h2 id="help-modal-title">The process</h2>
          </div>
          <button
            type="button"
            className="help-modal-close"
            onClick={onClose}
            aria-label="Close help"
            title="Close help"
          >
            &times;
          </button>
        </div>

        <div className="help-modal-body">
          <div className="help-modal-steps">
            {HELP_STEPS.map((step) => {
              const imageUrl = getStepImageUrl(step.imageIndex)

              return (
                <div className="help-step" key={step.id}>
                  {imageUrl ? (
                    <img className="help-step-image" src={imageUrl} alt={step.title} />
                  ) : (
                    <div className="help-step-image is-placeholder" role="img" aria-label="Image placeholder">
                      <span>Image placeholder</span>
                    </div>
                  )}
                  <div className="help-step-text">
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="help-demo">
            <p className="help-demo-kicker">See it in action</p>
            {demoVideoUrl ? (
              <video
                className="help-demo-video"
                src={demoVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                controls
              />
            ) : (
              <div className="help-demo-video is-placeholder" role="img" aria-label="Demo video placeholder">
                <span>Demo video placeholder</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
