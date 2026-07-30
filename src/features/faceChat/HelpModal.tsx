import { useEffect } from 'react'
import loopVideoUrl from '../../assets/loop_video.mp4'
import image1Url from '../../assets/project_images/image_1.png'
import image2Url from '../../assets/project_images/image_2.png'
import image3Url from '../../assets/project_images/image_3.png'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

interface HelpStep {
  id: string
  imageUrl: string
  title: string
  body: string
}

const HELP_STEPS: HelpStep[] = [
  {
    id: 'record',
    imageUrl: image1Url,
    title: '1. Recording',
    body: 'Using a webcam and MediaPipe, I record myself answering each question. MediaPipe reads my facial expressions in real time as a set of blendshape values (Stored in JSON).',
  },
  {
    id: 'map',
    imageUrl: image2Url,
    title: '2. Mapping',
    body: 'Those blendshape values are mapped onto a 3D avatar built in Three.js, so the model mirrors my expressions, head movement, and mouth shape frame by frame.',
  },
  {
    id: 'play',
    imageUrl: image3Url,
    title: '3. Playback',
    body: "The mapped performance is saved as a clip. When you pick a question, that clip replays here.",
  },
]

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
            {HELP_STEPS.map((step) => (
              <div className="help-step" key={step.id}>
                <img className="help-step-image" src={step.imageUrl} alt={step.title} />
                <div className="help-step-text">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="help-demo">
            <p className="help-demo-kicker">See it in action</p>
            <video
              className="help-demo-video"
              autoPlay
              loop
              muted
              playsInline
              controls
              preload="metadata"
              aria-label="Face-tracking avatar demonstration"
            >
              <source src={loopVideoUrl} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </div>
  )
}
