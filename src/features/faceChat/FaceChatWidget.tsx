import { useCallback, useEffect, useRef, useState } from 'react'
import ClipAvatar from './ClipAvatar'
import {
  ChoiceMarkerIcon,
  QuestionIcon,
  SettingsIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  type ChoiceMarkerKind,
} from './HudIcons'
import TranscriptPanel from './TranscriptPanel'
import {
  DIALOGUE_GRAPH,
  IDLE_CLIP_IDS,
  INTRO_NODE_ID,
  OPENING_NODE_IDS,
} from './dialogueGraph'
import {
  getVisibleDialogueChoices,
  markFollowupCompleted,
  type CompletedFollowups,
} from './dialogueFlow'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import { useClipPlayer, type ClipCompletionReason } from './clipPlayback'
import './FaceChatWidget.css'

interface DialogueHistoryEntry {
  // null represents the untouched opening menu before any answer has been selected.
  nodeId: number | null
  openingId: number
}

const CHOICE_MARKERS: readonly ChoiceMarkerKind[] = [
  'triangle',
  'square',
  'circle',
  'cross',
]

const OPTION_TRIANGLES = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
] as const

function OptionTriangleAnimation() {
  return (
    <span className="face-chat-option-triangle-layer" aria-hidden="true">
      {OPTION_TRIANGLES.map((triangle) => (
        <span
          key={triangle}
          className={`face-chat-option-triangle ${triangle}`}
        />
      ))}
    </span>
  )
}

interface FaceChatWidgetProps {
  centered?: boolean
}

// Camera-free prerecorded avatar chat. Follow-up branches behave as checklists: answered prompts
// stay completed, the remaining prompts continue to be offered, and the closing prompts unlock
// only after the active opening's follow-ups are exhausted.
export default function FaceChatWidget({ centered = false }: FaceChatWidgetProps) {
  const [currentNodeId, setCurrentNodeId] = useState<number>(INTRO_NODE_ID)
  const [activeOpeningId, setActiveOpeningId] = useState<number>(OPENING_NODE_IDS[0])
  const [isOpeningMenu, setIsOpeningMenu] = useState(false)
  const [completedFollowups, setCompletedFollowups] = useState<CompletedFollowups>({})
  const [dialogueHistory, setDialogueHistory] = useState<DialogueHistoryEntry[]>([])
  const [playbackPhase, setPlaybackPhase] = useState<'idle' | 'answer'>('answer')
  const [idleClipIndex, setIdleClipIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [targetFps, setTargetFps] = useState(60)
  const [expandedTranscriptNodeId, setExpandedTranscriptNodeId] = useState<number | null>(null)
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const node = DIALOGUE_GRAPH[currentNodeId]
  const isIdling = isOpeningMenu || playbackPhase === 'idle' || node.type === 'loop'
  const visibleTransitionIds = isOpeningMenu
    ? [...OPENING_NODE_IDS]
    : getVisibleDialogueChoices(
        currentNodeId,
        activeOpeningId,
        completedFollowups,
      )
  const canGoBack = !isOpeningMenu && dialogueHistory.length > 0
  const optionCount = visibleTransitionIds.length + (canGoBack ? 1 : 0)

  const handleClipComplete = useCallback((reason: ClipCompletionReason) => {
    if (playbackPhase === 'answer') {
      if (currentNodeId === INTRO_NODE_ID && reason === 'ended') {
        setCurrentNodeId(OPENING_NODE_IDS[0])
        setIsOpeningMenu(true)
      }

      setPlaybackPhase('idle')
      return
    }

    // Run both silent recorded idle performances continuously.
    setIdleClipIndex((index) => (index + 1) % IDLE_CLIP_IDS.length)
  }, [currentNodeId, playbackPhase])

  const activeClipId = isIdling ? IDLE_CLIP_IDS[idleClipIndex] : node.clipId
  const {
    activeFrame,
    error: clipError,
    playbackClipId,
    playbackTimeMs,
    playbackProgress,
    skip: skipActiveClip,
  } = useClipPlayer(
    activeClipId,
    'once',
    isMuted,
    {
      audioEnabled: !isIdling,
      onComplete: handleClipComplete,
    },
  )

  const handleSkip = useCallback(() => {
    if (!centered || isIdling) return

    setExpandedTranscriptNodeId(currentNodeId)
    skipActiveClip()
  }, [centered, currentNodeId, isIdling, skipActiveClip])

  useEffect(() => {
    promptHeadingRef.current?.focus()
  }, [currentNodeId, isOpeningMenu])

  const navigateTo = useCallback((nextId: number) => {
    const nextNode = DIALOGUE_GRAPH[nextId]

    if (!nextNode) return

    setExpandedTranscriptNodeId(null)

    setDialogueHistory((history) => [
      ...history,
      {
        nodeId: isOpeningMenu ? null : currentNodeId,
        openingId: activeOpeningId,
      },
    ])

    if (nextNode.type === 'opening') {
      setActiveOpeningId(nextId)
    } else if (nextNode.type === 'followup') {
      setCompletedFollowups((completed) =>
        markFollowupCompleted(completed, activeOpeningId, nextId),
      )
    }

    setCurrentNodeId(nextId)
    setIsOpeningMenu(false)
    setPlaybackPhase(nextNode.type === 'loop' ? 'idle' : 'answer')
  }, [activeOpeningId, currentNodeId, isOpeningMenu])

  const goBack = useCallback(() => {
    const previous = dialogueHistory[dialogueHistory.length - 1]

    if (!previous) return

    setExpandedTranscriptNodeId(null)
    setDialogueHistory((history) => history.slice(0, -1))

    if (previous.nodeId === null) {
      setIsOpeningMenu(true)
      setActiveOpeningId(previous.openingId)
      setPlaybackPhase('idle')
      return
    }

    setCurrentNodeId(previous.nodeId)
    setActiveOpeningId(previous.openingId)
    // Back navigates silently; it does not replay an already completed answer.
    setPlaybackPhase('idle')
  }, [dialogueHistory])

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (optionCount === 0) return

    let nextIndex: number | null = null

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % optionCount
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + optionCount) % optionCount
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = optionCount - 1
    }

    if (nextIndex !== null) {
      event.preventDefault()
      optionRefs.current[nextIndex]?.focus()
    }
  }

  const transcriptProgress = isIdling
    ? 1
    : playbackClipId === activeClipId
      ? playbackProgress
      : 0
  const transcriptPlaybackTimeMs = playbackClipId === activeClipId
    ? playbackTimeMs
    : 0
  const backButton = canGoBack ? (
    <button
      ref={(element) => {
        optionRefs.current[visibleTransitionIds.length] = element
      }}
      type="button"
      className="face-chat-option-bar face-chat-back-bar"
      tabIndex={visibleTransitionIds.length === 0 ? 0 : -1}
      onClick={goBack}
      onKeyDown={(event) => handleOptionKeyDown(event, visibleTransitionIds.length)}
      aria-label="Back to previous choices"
    >
      <OptionTriangleAnimation />
      <span className="face-chat-option-label">Back</span>
      <span className="face-chat-option-connector" aria-hidden="true" />
      <span className="face-chat-option-number" aria-hidden="true">
        <ChoiceMarkerIcon kind="back" className="face-chat-option-glyph is-back" />
      </span>
    </button>
  ) : null

  return (
    <div
      className={`face-chat-widget${centered ? ' is-centered-layout' : ''}`}
      data-playback-phase={isIdling ? 'idle' : 'answer'}
      data-active-clip={activeClipId}
      data-transcript-expanded={expandedTranscriptNodeId === currentNodeId || undefined}
    >
      <div className="face-chat-stage">
        <ClipAvatar
          activeFrame={activeFrame}
          critical={Boolean(clipError)}
          targetFps={targetFps}
        />
      </div>

      <div className={`face-chat-top-hud${isOpeningMenu ? ' is-opening-menu' : ''}`}>
        <div className="face-chat-transcript-frame">
          {!isOpeningMenu && (
            <TranscriptPanel
              nodeId={currentNodeId}
              clipId={activeClipId}
              isSpeaking={!isIdling}
              playbackTimeMs={transcriptPlaybackTimeMs}
              playbackProgress={transcriptProgress}
              isExpanded={expandedTranscriptNodeId === currentNodeId}
              onSkip={centered && !isIdling ? handleSkip : undefined}
            />
          )}
          {centered && isIdling && backButton}
        </div>

        <div className="face-chat-control-stack">
            <button
              type="button"
              className="face-chat-control-button"
              onClick={() => setIsMuted((muted) => !muted)}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Unmute avatar voice' : 'Mute avatar voice'}
              title={isMuted ? 'Unmute avatar voice' : 'Mute avatar voice'}
            >
              {isMuted
                ? <VolumeOffIcon className="face-chat-control-icon" />
                : <VolumeOnIcon className="face-chat-control-icon" />}
            </button>

            <div className="face-chat-settings-control">
              <button
                type="button"
                className="face-chat-control-button"
                onClick={() => setIsSettingsOpen((open) => !open)}
                aria-expanded={isSettingsOpen}
                aria-controls="face-chat-fps-settings"
                aria-label="Avatar performance settings"
                title="Avatar performance settings"
              >
                <SettingsIcon className="face-chat-control-icon" />
              </button>

              {isSettingsOpen && (
                <div
                  id="face-chat-fps-settings"
                  className="face-chat-fps-settings"
                  role="group"
                  aria-label="Avatar frame rate"
                >
                  <div className="face-chat-fps-heading">
                    <span>Render rate</span>
                    <output>{targetFps} FPS</output>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="60"
                    step="15"
                    value={targetFps}
                    onChange={(event) => setTargetFps(Number(event.target.value))}
                    aria-label="Avatar frames per second"
                  />
                  <div className="face-chat-fps-scale" aria-hidden="true">
                    <span>15</span>
                    <span>30</span>
                    <span>45</span>
                    <span>60</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="face-chat-control-button"
              aria-label="Help (coming soon)"
              title="Help (coming soon)"
            >
              <QuestionIcon className="face-chat-control-icon" />
            </button>
        </div>

        {isIdling && (
          <div className="face-chat-choice-layer" role="group" aria-label="Dialogue options">
            <div className="face-chat-options">
              {visibleTransitionIds.map((nextId, index) => (
                <button
                  key={nextId}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  type="button"
                  className="face-chat-option-bar"
                  tabIndex={index === 0 ? 0 : -1}
                  onClick={() => navigateTo(nextId)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                >
                  <OptionTriangleAnimation />
                  <span className="face-chat-option-label">{TRANSCRIPT_SCRIPT[nextId]?.prompt}</span>
                  <span className="face-chat-option-connector" aria-hidden="true" />
                  <span className="face-chat-option-number" aria-hidden="true">
                    <ChoiceMarkerIcon
                      kind={CHOICE_MARKERS[index % CHOICE_MARKERS.length]}
                      className={`face-chat-option-glyph is-${CHOICE_MARKERS[index % CHOICE_MARKERS.length]}`}
                    />
                  </span>
                </button>
              ))}
            </div>

            {!centered && backButton}
          </div>
        )}
      </div>

      <div className="face-chat-dialogue">
        {clipError && (
          <p className="face-chat-clip-error" role="status">
            Avatar clip unavailable right now — showing text only.
          </p>
        )}

        <h2
          className="face-chat-node-prompt face-chat-visually-hidden"
          ref={promptHeadingRef}
          tabIndex={-1}
        >
          {isOpeningMenu
            ? 'Choose an opening question'
            : TRANSCRIPT_SCRIPT[currentNodeId]?.prompt}
        </h2>

      </div>
    </div>
  )
}
