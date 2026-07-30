import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SectionId } from '../../components/NavBar'
import NodeField from '../../components/NodeField'
import ClipAvatar from './ClipAvatar'
import {
  ChoiceMarkerIcon,
  HudTriangleMesh,
  QuestionIcon,
  SettingsIcon,
  VolumeOffIcon,
  VolumeOnIcon,
  type ChoiceMarkerKind,
} from './HudIcons'
import TranscriptPanel from './TranscriptPanel'
import HelpModal from './HelpModal'
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

interface FaceChatWidgetProps {
  centered?: boolean
  activeSection?: SectionId
  isMuted: boolean
  onMutedChange: (isMuted: boolean) => void
}

type SectionPlaybackPhase = 'inactive' | 'waiting' | 'playing' | 'idle'
// 'pending' covers the initial load: the stage stays put (no glitch) until the 3D avatar has
// actually finished loading, so the reveal animation lands on something visible instead of
// playing out over the "Avatar loading…" placeholder.
type AvatarTransitionPhase = 'pending' | 'exiting' | 'entering' | 'steady'

interface SectionPlaybackState {
  section: SectionId | null
  phase: SectionPlaybackPhase
}

const SECTION_IDLE_DELAY_MS = 2000
const ABOUT_HUD_EXIT_MS = 220
const AVATAR_FADE_OUT_MS = 220
const AVATAR_LAYOUT_TRANSITION_MS = 700
const AVATAR_GLITCH_IN_MS = 560
const SECTION_CLIP_IDS: Partial<Record<SectionId, string>> = {
  resume: 'resume',
  skills: 'skills',
}

// Camera-free prerecorded avatar chat. Follow-up branches behave as checklists: answered prompts
// stay completed, the remaining prompts continue to be offered, and the closing prompts unlock
// only after the active opening's follow-ups are exhausted.
export default function FaceChatWidget({
  centered = false,
  activeSection = 'about',
  isMuted,
  onMutedChange,
}: FaceChatWidgetProps) {
  const [currentNodeId, setCurrentNodeId] = useState<number>(INTRO_NODE_ID)
  const [activeOpeningId, setActiveOpeningId] = useState<number>(OPENING_NODE_IDS[0])
  const [isOpeningMenu, setIsOpeningMenu] = useState(false)
  const [completedFollowups, setCompletedFollowups] = useState<CompletedFollowups>({})
  const [dialogueHistory, setDialogueHistory] = useState<DialogueHistoryEntry[]>([])
  const [playbackPhase, setPlaybackPhase] = useState<'idle' | 'answer'>('answer')
  const [idleClipIndex, setIdleClipIndex] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [targetFps, setTargetFps] = useState(60)
  const [expandedTranscriptNodeId, setExpandedTranscriptNodeId] = useState<number | null>(null)
  const [sectionPlayback, setSectionPlayback] = useState<SectionPlaybackState>({
    section: null,
    phase: 'inactive',
  })
  const [isAboutHudMounted, setIsAboutHudMounted] = useState(activeSection === 'about')
  const [avatarTransitionPhase, setAvatarTransitionPhase] = useState<AvatarTransitionPhase>('pending')
  const [isAvatarReady, setIsAvatarReady] = useState(false)
  const [isCenteredLayout, setIsCenteredLayout] = useState(centered)
  const promptHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const previousSectionRef = useRef<SectionId>(activeSection)

  const node = DIALOGUE_GRAPH[currentNodeId]
  const isAboutSection = activeSection === 'about'
  const shouldRenderAboutHud = isAboutSection || isAboutHudMounted
  const aboutHudState = isAboutSection
    ? 'visible'
    : isAboutHudMounted
      ? 'exiting'
      : 'hidden'
  const isDialogueIdling = isOpeningMenu || playbackPhase === 'idle' || node.type === 'loop'
  const sectionClipId = SECTION_CLIP_IDS[activeSection]
  const isSectionClipPlaying = Boolean(
    !isAboutSection
      && sectionClipId
      && sectionPlayback.section === activeSection
      && sectionPlayback.phase === 'playing',
  )
  const isIdling = isAboutSection ? isDialogueIdling : !isSectionClipPlaying
  const visibleTransitionIds = isOpeningMenu
    ? [...OPENING_NODE_IDS]
    : getVisibleDialogueChoices(
        currentNodeId,
        activeOpeningId,
        completedFollowups,
      )
  const canGoBack = isAboutSection
    && !isOpeningMenu
    && node.type !== 'loop'
    && dialogueHistory.length > 0
  const optionCount = visibleTransitionIds.length + (canGoBack ? 1 : 0)

  const handleClipComplete = useCallback((reason: ClipCompletionReason) => {
    if (!isAboutSection) {
      if (isSectionClipPlaying) {
        setSectionPlayback((current) => current.section === activeSection
          ? { ...current, phase: 'idle' }
          : current)
      } else {
        setIdleClipIndex((index) => (index + 1) % IDLE_CLIP_IDS.length)
      }
      return
    }

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
  }, [activeSection, currentNodeId, isAboutSection, isSectionClipPlaying, playbackPhase])

  const activeClipId = isSectionClipPlaying && sectionClipId
    ? sectionClipId
    : isIdling
      ? IDLE_CLIP_IDS[idleClipIndex]
      : node.clipId
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
    if (!isAboutSection || !centered || isIdling) return

    setExpandedTranscriptNodeId(currentNodeId)
    skipActiveClip()
  }, [centered, currentNodeId, isAboutSection, isIdling, skipActiveClip])

  // First reveal: hold at 'pending' (no glitch) until the avatar actually finishes loading,
  // then play the glitch-in over the real model instead of the loading placeholder. Runs once —
  // guarded by isAvatarReady alone so the 'entering' -> 'steady' timeout it schedules isn't
  // cancelled by its own state update re-triggering this effect.
  useEffect(() => {
    if (!isAvatarReady) return

    setAvatarTransitionPhase('entering')

    const finishInitialReveal = window.setTimeout(() => {
      setAvatarTransitionPhase('steady')
    }, AVATAR_GLITCH_IN_MS)

    return () => window.clearTimeout(finishInitialReveal)
  }, [isAvatarReady])

  useLayoutEffect(() => {
    const previousSection = previousSectionRef.current

    if (previousSection === activeSection) return

    previousSectionRef.current = activeSection

    setAvatarTransitionPhase('exiting')

    const layoutIsChanging = previousSection === 'about' || activeSection === 'about'
    const revealDelay = layoutIsChanging
      ? AVATAR_FADE_OUT_MS + AVATAR_LAYOUT_TRANSITION_MS
      : AVATAR_FADE_OUT_MS
    const revealAvatar = window.setTimeout(() => {
      setIsCenteredLayout(centered)
      setAvatarTransitionPhase('entering')
    }, revealDelay)
    const finishReveal = window.setTimeout(() => {
      setAvatarTransitionPhase('steady')
    }, revealDelay + AVATAR_GLITCH_IN_MS)

    return () => {
      window.clearTimeout(revealAvatar)
      window.clearTimeout(finishReveal)
    }
  }, [activeSection, centered])

  useEffect(() => {
    if (!isAboutSection) {
      setIsHelpOpen(false)
    }
  }, [isAboutSection])

  useEffect(() => {
    if (isAboutSection) {
      setIsAboutHudMounted(true)
      return
    }

    const unmountAboutHud = window.setTimeout(() => {
      setIsAboutHudMounted(false)
    }, ABOUT_HUD_EXIT_MS)

    return () => window.clearTimeout(unmountAboutHud)
  }, [isAboutSection])

  useEffect(() => {
    if (isAboutSection) {
      setSectionPlayback({ section: null, phase: 'inactive' })
      return
    }

    // Leaving About always interrupts the current response. Returning later resumes the
    // conversation at its current choices instead of restarting a partially heard answer.
    setPlaybackPhase('idle')
    setExpandedTranscriptNodeId(null)

    if (!sectionClipId) {
      setSectionPlayback({ section: activeSection, phase: 'idle' })
      return
    }

    setSectionPlayback({ section: activeSection, phase: 'waiting' })

    const startSectionClip = window.setTimeout(() => {
      setSectionPlayback((current) => current.section === activeSection
        ? { ...current, phase: 'playing' }
        : current)
    }, SECTION_IDLE_DELAY_MS)

    return () => window.clearTimeout(startSectionClip)
  }, [activeSection, isAboutSection, sectionClipId])

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
      <span className="face-chat-option-label">Back</span>
      <span className="face-chat-option-connector" aria-hidden="true" />
      <span className="face-chat-option-number" aria-hidden="true">
        <ChoiceMarkerIcon kind="back" className="face-chat-option-glyph is-back" />
      </span>
    </button>
  ) : null

  return (
    <div
      className={`face-chat-widget${isCenteredLayout ? ' is-centered-layout' : ''}${shouldRenderAboutHud ? ' has-about-hud' : ''}`}
      data-playback-phase={isIdling ? 'idle' : 'answer'}
      data-active-clip={activeClipId}
      data-active-section={activeSection}
      data-about-hud-state={aboutHudState}
      data-avatar-transition={avatarTransitionPhase}
      data-section-playback={isAboutSection ? 'dialogue' : sectionPlayback.phase}
      data-transcript-expanded={expandedTranscriptNodeId === currentNodeId || undefined}
    >
      {isCenteredLayout && <NodeField className="face-chat-node-field" />}

      <div className="face-chat-stage">
        <ClipAvatar
          activeFrame={activeFrame}
          critical={Boolean(clipError)}
          yellowHud={activeSection === 'contact'}
          targetFps={targetFps}
          personalMoment={!isIdling && (node.type === 'followup' || node.type === 'closing')}
          onReady={() => setIsAvatarReady(true)}
        />
      </div>

      <div className={`face-chat-top-hud${isOpeningMenu ? ' is-opening-menu' : ''}`}>
        <div className="face-chat-transcript-frame">
          {shouldRenderAboutHud && !isOpeningMenu && (
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
          {isAboutSection && centered && isIdling && backButton}
        </div>

        <div className="face-chat-control-stack">
            <button
              type="button"
              className="face-chat-control-button"
              data-interface-sound-toggle="true"
              onClick={() => onMutedChange(!isMuted)}
              aria-pressed={isMuted}
              aria-label={isMuted ? 'Unmute all sounds' : 'Mute all sounds'}
              title={isMuted ? 'Unmute all sounds' : 'Mute all sounds'}
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

            {isAboutSection && (
              <button
                type="button"
                className="face-chat-control-button"
                onClick={() => setIsHelpOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isHelpOpen}
                aria-label="How this avatar works"
                title="How this avatar works"
              >
                <QuestionIcon className="face-chat-control-icon" />
              </button>
            )}
        </div>

        {isAboutSection && isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

        {shouldRenderAboutHud && isDialogueIdling && (
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
                  <HudTriangleMesh className="face-chat-option-triangle-mesh" />
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
