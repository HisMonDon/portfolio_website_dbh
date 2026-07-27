export function revealTranscriptText(text: string, progress: number): string {
  if (!text || progress <= 0) return ''
  if (progress >= 1) return text

  const clampedProgress = Math.min(Math.max(progress, 0), 1)
  const visibleCharacterCount = Math.floor(text.length * clampedProgress)

  return text.slice(0, visibleCharacterCount)
}

export interface TranscriptWordTiming {
  text: string
  startChar: number
  endChar: number
  startMs: number
  endMs: number
}

// Reveals completed words and types through the word currently being spoken. These timestamps
// are generated offline; this function is the only runtime work required for synchronized text.
export function revealTimedTranscriptText(
  text: string,
  words: readonly TranscriptWordTiming[],
  playbackTimeMs: number,
): string {
  if (!text || words.length === 0 || playbackTimeMs < words[0].startMs) return ''

  let visibleCharacterCount = 0

  for (const word of words) {
    if (playbackTimeMs < word.startMs) break

    if (playbackTimeMs >= word.endMs || word.endMs <= word.startMs) {
      visibleCharacterCount = word.endChar
      continue
    }

    const wordProgress = (playbackTimeMs - word.startMs) / (word.endMs - word.startMs)
    const visibleWordCharacters = Math.ceil(
      (word.endChar - word.startChar) * Math.min(Math.max(wordProgress, 0), 1),
    )
    visibleCharacterCount = word.startChar + visibleWordCharacters
    break
  }

  return text.slice(0, visibleCharacterCount)
}
