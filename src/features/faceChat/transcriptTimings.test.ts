import { describe, expect, it } from 'vitest'
import { DIALOGUE_GRAPH } from './dialogueGraph'
import { TRANSCRIPT_SCRIPT } from './transcriptScript'
import transcriptTimingsJson from './transcriptTimings.json'

describe('generated avatar transcript timings', () => {
  const spokenNodes = Object.values(DIALOGUE_GRAPH).filter((node) => node.type !== 'loop')

  it('covers every spoken dialogue clip with the current authoritative text', () => {
    spokenNodes.forEach((node) => {
      const timing = transcriptTimingsJson.clips[
        node.clipId as keyof typeof transcriptTimingsJson.clips
      ]

      expect(timing, `missing timing for ${node.clipId}`).toBeDefined()
      expect(timing.text).toBe(TRANSCRIPT_SCRIPT[node.id].response)
    })
  })

  it('maps every stored word back to the exact transcript and valid time range', () => {
    Object.values(transcriptTimingsJson.clips).forEach((clip) => {
      let previousStartMs = 0

      clip.words.forEach((word) => {
        expect(clip.text.slice(word.startChar, word.endChar)).toBe(word.text)
        expect(word.startMs).toBeGreaterThanOrEqual(previousStartMs)
        expect(word.endMs).toBeGreaterThanOrEqual(word.startMs)
        expect(word.endMs).toBeLessThanOrEqual(clip.durationMs)
        previousStartMs = word.startMs
      })
    })
  })
})
