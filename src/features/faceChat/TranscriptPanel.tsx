import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import './TranscriptPanel.css'

interface TranscriptPanelProps {
  nodeId: number
}

// Always-visible per-node transcript of the currently active dialogue script
// (the "live transcript" panel next to the avatar) — no expand/collapse, so
// its content is in the accessibility tree unconditionally rather than
// gated behind a toggle.
export default function TranscriptPanel({ nodeId }: TranscriptPanelProps) {
  const entry = TRANSCRIPT_SCRIPT[nodeId]

  if (!entry) return null

  return (
    <div className="transcript-panel" role="region" aria-label="Dialogue transcript">
      <p className="transcript-eyebrow">Live transcript</p>
      <p className="transcript-prompt">{entry.prompt}</p>
      <p className="transcript-response">{entry.response}</p>
    </div>
  )
}
