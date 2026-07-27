import { describe, expect, it } from 'vitest'
import {
  getVisibleDialogueChoices,
  markFollowupCompleted,
  type CompletedFollowups,
} from './dialogueFlow'

describe('follow-up branch flow', () => {
  it('returns the remaining follow-up after the first answer instead of jumping to closings', () => {
    const completed = markFollowupCompleted({}, 1, 5)

    expect(getVisibleDialogueChoices(5, 1, completed)).toEqual([6])
  })

  it('offers the closing choices only after every follow-up in the branch is complete', () => {
    let completed: CompletedFollowups = {}
    completed = markFollowupCompleted(completed, 1, 5)
    completed = markFollowupCompleted(completed, 1, 6)

    expect(getVisibleDialogueChoices(6, 1, completed)).toEqual([17, 18])
  })

  it('handles the three-question branch and preserves progress independently per opening', () => {
    let completed: CompletedFollowups = {}
    completed = markFollowupCompleted(completed, 4, 11)
    completed = markFollowupCompleted(completed, 4, 13)
    completed = markFollowupCompleted(completed, 1, 5)

    expect(getVisibleDialogueChoices(13, 4, completed)).toEqual([12])
    expect(getVisibleDialogueChoices(5, 1, completed)).toEqual([6])
  })

  it('does not duplicate completion when an answer is revisited', () => {
    const once = markFollowupCompleted({}, 1, 5)
    const twice = markFollowupCompleted(once, 1, 5)

    expect(twice).toBe(once)
  })

  it('retains the graph transitions for closing and loop nodes', () => {
    expect(getVisibleDialogueChoices(17, 1, {})).toEqual([19])
    expect(getVisibleDialogueChoices(19, 1, {})).toEqual([1, 2, 3, 4])
  })
})
