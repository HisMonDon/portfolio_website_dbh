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
}: TranscriptPanelProps) {
  const entry = TRANSCRIPT_SCRIPT[nodeId]

  if (!entry) return null

  const timing = TRANSCRIPT_TIMINGS[clipId]
  const hasCurrentTiming = timing?.text === entry.response
  const visibleResponse = !isSpeaking
    ? entry.response
    : hasCurrentTiming
      ? revealTimedTranscriptText(entry.response, timing.words, playbackTimeMs)
      : revealTranscriptText(entry.response, playbackProgress)

  return (
    <div className="transcript-panel" role="region" aria-label="Avatar transcript">
      <p className="transcript-eyebrow">Live transcript</p>
      <p className="transcript-prompt">{entry.prompt}</p>
      <p
        className={`transcript-response${isSpeaking ? ' is-typing' : ''}`}
        aria-live={isSpeaking ? 'polite' : 'off'}
      >
        <span className="transcript-response-reserve" aria-hidden="true">
          {entry.response}
        </span>
        <span className="transcript-response-visible">
          {visibleResponse}
        </span>
      </p>
    </div>
  )
}
