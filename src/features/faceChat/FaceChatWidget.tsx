import { useEffect, useMemo, useRef, useState } from 'react'
import FaceTrackingAvatar from './FaceTrackingAvatar'
import TranscriptPanel from './TranscriptPanel'
import { DIALOGUE_GRAPH, OPENING_NODE_IDS } from './dialogueGraph'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import { useClipPlayer } from './clipPlayback'
import { isLikelyMobile } from './deviceDetect'
import './FaceChatWidget.css'

type GateState = 'gate' | 'granted' | 'declined'

// Self-contained face-tracking avatar chat widget: permission gate ->
// live camera/Three.js avatar + branching dialogue with clip playback and
// a toggleable transcript. See dialogueGraph.ts for the 16-node structure.
//
// NOTE on browser history: `currentNodeId` is plain component state, not
// synced to the URL/history at all (no pushState, no popstate listener).
// So there's nothing today for browser back/forward to interact with —
// navigating dialogue nodes never creates history entries, and pressing
// back leaves the site entirely rather than stepping to a previous node.
// The loop node (#14) behaves correctly *within* the graph (its
// transitions correctly fan back out to all 4 openings), but if the
// intent was for back/forward to step through dialogue history, that's a
// gap, not something fixed here — wiring node state into the URL/history
// API is a bigger architectural addition than this hardening pass implies.
export default function FaceChatWidget() {
  const mobileFallback = useMemo(() => isLikelyMobile(), [])
  const [gate, setGate] = useState<GateState>('gate')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<number>(OPENING_NODE_IDS[0])
  const clipVideoRef = useRef<HTMLVideoElement | null>(null)
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const node = DIALOGUE_GRAPH[currentNodeId]
  const { error: clipError } = useClipPlayer(node.clipId, clipVideoRef)

  const started = gate === 'granted' && !mobileFallback

  // Focus management: every time the active node changes, move focus to
  // the new prompt heading. That both puts focus somewhere sensible after
  // a transition (rather than leaving it on a now-stale/removed button)
  // and causes screen readers to announce the new question.
  useEffect(() => {
    promptHeadingRef.current?.focus()
  }, [currentNodeId])

  function handleEnableCamera() {
    setCameraError(null)
    setGate('granted')
  }

  function handleCameraError(message: string) {
    setCameraError(message)
    setGate('declined')
  }

  // Roving-tabindex arrow-key navigation across the current node's option
  // buttons (a standard pattern for a button group: only one option is a
  // tab stop at a time, arrow keys move focus between siblings).
  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = node.transitions.length

    if (count === 0) return

    let nextIndex: number | null = null

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % count
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + count) % count
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = count - 1
    }

    if (nextIndex !== null) {
      event.preventDefault()
      optionRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div className="face-chat-widget">
      <div className="face-chat-stage">
        {mobileFallback || gate === 'declined' ? (
          <div className="face-chat-fallback" role="status" aria-live="polite">
            <p>Camera preview isn't available here.</p>
            <p className="face-chat-fallback-sub">
              {mobileFallback
                ? 'Try this on a desktop browser to chat with the live face-tracking avatar.'
                : cameraError ?? 'Camera access was declined.'}
            </p>
          </div>
        ) : gate === 'gate' ? (
          <div className="face-chat-gate">
            <div className="face-tracking-avatar-placeholder-standin" aria-hidden="true">
              <span>Your avatar goes here</span>
            </div>
            <button
              type="button"
              className="face-chat-enable-btn"
              onClick={handleEnableCamera}
              aria-label="Enable camera and start the live face-tracking avatar"
            >
              Click to enable camera
            </button>
          </div>
        ) : (
          <FaceTrackingAvatar started={started} onError={handleCameraError} />
        )}
      </div>

      {/* src/play/pause are owned imperatively by useClipPlayer so that
          switching nodes mid-playback can't overlap two clips. */}
      <video ref={clipVideoRef} className="face-chat-clip-video" muted playsInline loop />

      <div className="face-chat-dialogue">
        {clipError && (
          <p className="face-chat-clip-error" role="status">
            Avatar clip unavailable right now — showing text only.
          </p>
        )}

        <h2
          className="face-chat-node-prompt"
          ref={promptHeadingRef}
          tabIndex={-1}
        >
          {TRANSCRIPT_SCRIPT[currentNodeId]?.prompt}
        </h2>

        <div
          className="face-chat-options"
          role="group"
          aria-label="Dialogue options"
        >
          {node.transitions.map((nextId, index) => (
            <button
              key={nextId}
              ref={(el) => {
                optionRefs.current[index] = el
              }}
              type="button"
              className="face-chat-option-btn"
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => setCurrentNodeId(nextId)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
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
