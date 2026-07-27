import { useEffect } from 'react'
import './HelpModal.css'

interface HelpModalProps {
  onClose: () => void
}

interface HelpStep {
  id: string
  title: string
  body: string
}

const HELP_STEPS: HelpStep[] = [
  {
    id: 'record',
    title: '1. Recording',
    body: 'Using a webcam and MediaPipe, I record myself answering each question. MediaPipe reads my facial expressions in real time as a set of blendshape values.',
  },
  {
    id: 'map',
    title: '2. Mapping',
    body: 'Those blendshape values are mapped onto a 3D avatar built in Three.js, so the model mirrors my expressions, head movement, and mouth shape frame by frame.',
  },
  {
    id: 'play',
    title: '3. Playback',
    body: "The mapped performance is saved as a clip. When you pick a question, that clip replays here — no camera or live tracking is needed on your end.",
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
                <div className="help-step-image" role="img" aria-label="Image placeholder">
                  <span>Image placeholder</span>
                </div>
                <div className="help-step-text">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="help-demo">
            <p className="help-demo-kicker">See it in action</p>
            <div className="help-demo-video" role="img" aria-label="Demo video placeholder">
              <span>Demo video placeholder</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
