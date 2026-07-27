import { useLayoutEffect, useRef } from 'react'
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
  const responseRef = useRef<HTMLParagraphElement | null>(null)
  const measuredClipIdRef = useRef(clipId)
  const previousScrollHeightRef = useRef(0)
  const entry = TRANSCRIPT_SCRIPT[nodeId]
  const timing = TRANSCRIPT_TIMINGS[clipId]
  const revealedResponse = !entry
    ? ''
    : !isSpeaking
      ? entry.response
      : timing?.text === entry.response
        ? revealTimedTranscriptText(entry.response, timing.words, playbackTimeMs)
        : revealTranscriptText(entry.response, playbackProgress)

  useLayoutEffect(() => {
    const response = responseRef.current

    if (!response) return

    if (measuredClipIdRef.current !== clipId) {
      measuredClipIdRef.current = clipId
      previousScrollHeightRef.current = 0
      response.scrollTop = 0
    }

    const nextScrollHeight = response.scrollHeight

    // scrollHeight changes only when wrapping creates another rendered line. Keeping the
    // scroll position fixed between those changes prevents the transcript from crawling with
    // every newly revealed word.
    if (nextScrollHeight > previousScrollHeightRef.current + 1) {
      response.scrollTop = Math.max(0, nextScrollHeight - response.clientHeight)
    }

    previousScrollHeightRef.current = nextScrollHeight
  }, [clipId, revealedResponse])

  if (!entry) return null

  return (
    <div
      className="transcript-panel"
      role="region"
      aria-label="Avatar transcript"
      aria-busy={isSpeaking}
    >
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
      <p
        ref={responseRef}
        className={`transcript-response${isSpeaking ? ' is-typing' : ''}`}
        aria-live={isSpeaking ? 'polite' : 'off'}
      >
        <span className="transcript-response-visible">
          {revealedResponse}
        </span>
      </p>
      <span className="transcript-full-response">
        Full response: {entry.response}
      </span>
    </div>
  )
}
