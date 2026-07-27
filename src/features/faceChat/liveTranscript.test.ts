import { describe, expect, it } from 'vitest'
import {
  revealTimedTranscriptText,
  revealTranscriptText,
} from './liveTranscript'

describe('live avatar transcript', () => {
  it('starts empty and ends with the exact full response', () => {
    expect(revealTranscriptText('Hello there.', 0)).toBe('')
    expect(revealTranscriptText('Hello there.', 1)).toBe('Hello there.')
  })

  it('reveals text proportionally through playback', () => {
    expect(revealTranscriptText('abcdefghij', 0.5)).toBe('abcde')
  })

  it('clamps playback progress outside the valid range', () => {
    expect(revealTranscriptText('Hello', -1)).toBe('')
    expect(revealTranscriptText('Hello', 2)).toBe('Hello')
  })
})

describe('stored word-timed transcript', () => {
  const text = 'Hello there.'
  const words = [
    { text: 'Hello', startChar: 0, endChar: 5, startMs: 100, endMs: 600 },
    { text: 'there.', startChar: 6, endChar: 12, startMs: 800, endMs: 1400 },
  ]

  it('stays empty until the first aligned word begins', () => {
    expect(revealTimedTranscriptText(text, words, 99)).toBe('')
  })

  it('types through the word currently being spoken', () => {
    expect(revealTimedTranscriptText(text, words, 300)).toBe('He')
    expect(revealTimedTranscriptText(text, words, 1100)).toBe('Hello the')
  })

  it('holds completed text through pauses and finishes exactly', () => {
    expect(revealTimedTranscriptText(text, words, 700)).toBe('Hello')
    expect(revealTimedTranscriptText(text, words, 1400)).toBe(text)
  })
})
