import { useMemo, useRef, useState } from 'react'
import FaceTrackingAvatar from './FaceTrackingAvatar'
import TranscriptPanel from './TranscriptPanel'
import { DIALOGUE_GRAPH, OPENING_NODE_IDS } from './dialogueGraph'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import { CLIP_VIDEO_URLS, useClipBlendshapes } from './clipPlayback'
import { isLikelyMobile } from './deviceDetect'
import './FaceChatWidget.css'

type GateState = 'gate' | 'granted' | 'declined'

// Self-contained face-tracking avatar chat widget: permission gate ->
// live camera/Three.js avatar + branching dialogue with clip playback and
// a toggleable transcript. See dialogueGraph.ts for the 16-node structure.
export default function FaceChatWidget() {
  const mobileFallback = useMemo(() => isLikelyMobile(), [])
  const [gate, setGate] = useState<GateState>('gate')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<number>(OPENING_NODE_IDS[0])
  const clipVideoRef = useRef<HTMLVideoElement | null>(null)

  const node = DIALOGUE_GRAPH[currentNodeId]
  const clipUrl = CLIP_VIDEO_URLS[node.clipId]
  useClipBlendshapes(node.clipId, clipVideoRef)

  const started = gate === 'granted' && !mobileFallback

  function handleEnableCamera() {
    setCameraError(null)
    setGate('granted')
  }

  function handleCameraError(message: string) {
    setCameraError(message)
    setGate('declined')
  }

  return (
    <div className="face-chat-widget">
      <div className="face-chat-stage">
        {mobileFallback || gate === 'declined' ? (
          <div className="face-chat-fallback">
            <p>Camera preview isn't available here.</p>
            <p className="face-chat-fallback-sub">
              {mobileFallback
                ? 'Try this on a desktop browser to chat with the live face-tracking avatar.'
                : cameraError ?? 'Camera access was declined.'}
            </p>
          </div>
        ) : gate === 'gate' ? (
          <div className="face-chat-gate">
            <div className="face-tracking-avatar-placeholder-standin">
              <span>Your avatar goes here</span>
            </div>
            <button type="button" className="face-chat-enable-btn" onClick={handleEnableCamera}>
              Click to enable camera
            </button>
          </div>
        ) : (
          <FaceTrackingAvatar started={started} onError={handleCameraError} />
        )}
      </div>

      <video
        ref={clipVideoRef}
        className="face-chat-clip-video"
        src={clipUrl}
        muted
        playsInline
        autoPlay
        loop
      />

      <div className="face-chat-dialogue">
        <p className="face-chat-node-prompt">{TRANSCRIPT_SCRIPT[currentNodeId]?.prompt}</p>

        <div className="face-chat-options">
          {node.transitions.map((nextId) => (
            <button
              key={nextId}
              type="button"
              className="face-chat-option-btn"
              onClick={() => setCurrentNodeId(nextId)}
            >
              {TRANSCRIPT_SCRIPT[nextId]?.prompt}
            </button>
          ))}
        </div>

        <TranscriptPanel nodeId={currentNodeId} />
      </div>
    </div>
  )
}
