import { useState } from 'react'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import './TranscriptPanel.css'

interface TranscriptPanelProps {
  nodeId: number
}

// Toggleable per-node transcript of the currently active dialogue script.
export default function TranscriptPanel({ nodeId }: TranscriptPanelProps) {
  const [visible, setVisible] = useState(false)
  const entry = TRANSCRIPT_SCRIPT[nodeId]

  return (
    <div className="transcript-panel">
      <button
        type="button"
        className="transcript-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-expanded={visible}
      >
        {visible ? 'Hide transcript' : 'Show transcript'}
      </button>

      {visible && entry && (
        <div className="transcript-body">
          <p className="transcript-prompt">{entry.prompt}</p>
          <p className="transcript-response">{entry.response}</p>
        </div>
      )}
    </div>
  )
}
