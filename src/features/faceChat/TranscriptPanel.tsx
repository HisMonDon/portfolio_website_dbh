import {
  revealTimedTranscriptText,
  revealTranscriptText,
  type TranscriptWordTiming,
} from './liveTranscript'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import transcriptTimingsJson from './transcriptTimings.json'
import './TranscriptPanel.css'

interface TranscriptPanelProps {
  nodeId: number
  clipId: string
  isSpeaking: boolean
  playbackTimeMs: number
  playbackProgress: number
  isExpanded?: boolean
  onSkip?: () => void
}

interface TranscriptTimingEntry {
  text: string
  words: TranscriptWordTiming[]
}

const TRANSCRIPT_TIMINGS = transcriptTimingsJson.clips as Record<
  string,
  TranscriptTimingEntry | undefined
>

export default function TranscriptPanel({
  nodeId,
  clipId,
  isSpeaking,
  playbackTimeMs,
  playbackProgress,
  isExpanded = false,
  onSkip,
}: TranscriptPanelProps) {
  const entry = TRANSCRIPT_SCRIPT[nodeId]
  const timing = TRANSCRIPT_TIMINGS[clipId]
  const revealedResponse = !entry
    ? ''
    : !isSpeaking
      ? entry.response
      : timing?.text === entry.response
        ? revealTimedTranscriptText(entry.response, timing.words, playbackTimeMs)
        : revealTranscriptText(entry.response, playbackProgress)

  if (!entry) return null

  return (
    <div
      className={`transcript-panel${isExpanded ? ' is-expanded' : ''}`}
      role="region"
      aria-label="Avatar transcript"
      aria-busy={isSpeaking}
    >
      <span className="transcript-corner is-top-right" aria-hidden="true" />
      <span className="transcript-corner is-bottom-left" aria-hidden="true" />
      <div className="transcript-heading">
        <span
          className={`transcript-activity${isSpeaking ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </span>
        <p className="transcript-prompt">{entry.prompt}</p>
      </div>
      {onSkip && (
        <button
          type="button"
          className="transcript-skip-button"
          onClick={onSkip}
          aria-label="Skip to the end of this response"
          title="Skip to the end of this response"
        >
          <span>Skip</span>
          <span className="transcript-skip-mark" aria-hidden="true">{'>>'}</span>
        </button>
      )}
      <span className="transcript-divider" aria-hidden="true" />
      <p
        className={`transcript-response${isSpeaking ? ' is-typing' : ''}`}
        aria-live={isSpeaking ? 'polite' : 'off'}
      >
        <span className="transcript-response-visible">
          {revealedResponse}
        </span>
        <span className="transcript-response-sizer" aria-hidden="true">
          {entry.response}
        </span>
      </p>
      <span className="transcript-full-response">
        Full response: {entry.response}
      </span>
    </div>
  )
}
