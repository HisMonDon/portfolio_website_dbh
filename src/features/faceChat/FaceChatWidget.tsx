import { useCallback, useEffect, useRef, useState } from 'react'
import ClipAvatar from './ClipAvatar'
import TranscriptPanel from './TranscriptPanel'
import { DIALOGUE_GRAPH, IDLE_CLIP_IDS, OPENING_NODE_IDS } from './dialogueGraph'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import { useClipPlayer } from './clipPlayback'
import './FaceChatWidget.css'

// Self-contained prerecorded-clip avatar chat widget: a camera-free Three.js
// avatar (ClipAvatar) driven entirely by clip playback (clipPlayback.ts) +
// branching dialogue with a numbered-choice, DBH-style UI and an always-on
// transcript. See dialogueGraph.ts for the 16-node structure. This never
// requests camera access — that's a
// distinct concern belonging to the live-tracking component
// (FaceTrackingAvatar), which isn't mounted here.
//
// NOTE on browser history: `currentNodeId` is plain component state, not
// synced to the URL/history at all (no pushState, no popstate listener).
// So there's nothing today for browser back/forward to interact with —
// navigating dialogue nodes never creates history entries, and pressing
// back leaves the site entirely rather than stepping to a previous node.
// The loop node (#19) behaves correctly *within* the graph (its
// transitions correctly fan back out to all 4 openings), but if the
// intent was for back/forward to step through dialogue history, that's a
// gap, not something fixed here — wiring node state into the URL/history
// API is a bigger architectural addition than this hardening pass implies.
export default function FaceChatWidget() {
  const [currentNodeId, setCurrentNodeId] = useState<number>(OPENING_NODE_IDS[0])
  const [playbackPhase, setPlaybackPhase] = useState<'idle' | 'answer'>('idle')
  const [idleClipIndex, setIdleClipIndex] = useState(0)
  // Mutes only the audio track; the transcript keeps showing prompt/response text and the
  // blendshape animation keeps playing regardless of mute state.
  const [isMuted, setIsMuted] = useState(false)
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const node = DIALOGUE_GRAPH[currentNodeId]
  const isIdling = playbackPhase === 'idle' || node.type === 'loop'

  const handleClipComplete = useCallback(() => {
    if (playbackPhase === 'answer') {
      setPlaybackPhase('idle')
      return
    }

    // Run both recorded idle performances continuously instead of repeating one forever.
    setIdleClipIndex((index) => (index + 1) % IDLE_CLIP_IDS.length)
  }, [playbackPhase])

  const activeClipId = isIdling ? IDLE_CLIP_IDS[idleClipIndex] : node.clipId
  const { activeFrame, error: clipError } = useClipPlayer(
    activeClipId,
    'once',
    isMuted,
    {
      // Idle playback is visual-only. No Audio object is created, so unmuting answers can never
      // accidentally make either idle recording audible.
      audioEnabled: !isIdling,
      onComplete: handleClipComplete,
    },
  )

  // Focus management: every time the active node changes, move focus to
  // the new prompt heading. That both puts focus somewhere sensible after
  // a transition (rather than leaving it on a now-stale/removed button)
  // and causes screen readers to announce the new question.
  useEffect(() => {
    promptHeadingRef.current?.focus()
  }, [currentNodeId])

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
    <div
      className="face-chat-widget"
      data-playback-phase={isIdling ? 'idle' : 'answer'}
      data-active-clip={activeClipId}
    >
      <button
        type="button"
        className="face-chat-mute-toggle"
        onClick={() => setIsMuted((muted) => !muted)}
        aria-pressed={isMuted}
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <div className="face-chat-stage">
        <ClipAvatar activeFrame={activeFrame} critical={Boolean(clipError)} />
      </div>

      <div className="face-chat-dialogue">
        {clipError && (
          <p className="face-chat-clip-error" role="status">
            Avatar clip unavailable right now — showing text only.
          </p>
        )}

        {/* Still the focus target on every node change (screen readers announce this
            text), but visually hidden — the visible prompt now lives in the always-on
            transcript panel below, so it isn't shown twice. */}
        <h2
          className="face-chat-node-prompt face-chat-visually-hidden"
          ref={promptHeadingRef}
          tabIndex={-1}
        >
          {TRANSCRIPT_SCRIPT[currentNodeId]?.prompt}
        </h2>

        <TranscriptPanel nodeId={currentNodeId} />

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
              className="face-chat-option-bar"
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => {
                setCurrentNodeId(nextId)
                setPlaybackPhase(DIALOGUE_GRAPH[nextId].type === 'loop' ? 'idle' : 'answer')
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
            >
              <span className="face-chat-option-label">{TRANSCRIPT_SCRIPT[nextId]?.prompt}</span>
              <span className="face-chat-option-connector" aria-hidden="true" />
              <span className="face-chat-option-number">{index + 1}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
