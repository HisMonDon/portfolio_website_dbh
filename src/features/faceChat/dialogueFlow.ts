import { CLOSING_NODE_IDS, DIALOGUE_GRAPH } from './dialogueGraph'

export type CompletedFollowups = Record<number, readonly number[]>

export function markFollowupCompleted(
  completed: CompletedFollowups,
  openingId: number,
  followupId: number,
): CompletedFollowups {
  const alreadyCompleted = completed[openingId] ?? []

  if (alreadyCompleted.includes(followupId)) return completed

  return {
    ...completed,
    [openingId]: [...alreadyCompleted, followupId],
  }
}

// Opening branches are conversational checklists rather than mutually exclusive forks. While
// any follow-up remains, every opening/follow-up screen offers only those unanswered prompts.
// The shared closing prompts appear only after that branch's entire follow-up set is complete.
export function getVisibleDialogueChoices(
  currentNodeId: number,
  activeOpeningId: number,
  completed: CompletedFollowups,
): number[] {
  const currentNode = DIALOGUE_GRAPH[currentNodeId]
  const openingNode = DIALOGUE_GRAPH[activeOpeningId]

  if (!currentNode || !openingNode) return []

  if (currentNode.type === 'opening' || currentNode.type === 'followup') {
    const completedForBranch = completed[activeOpeningId] ?? []
    const remainingFollowups = openingNode.transitions.filter(
      (followupId) => !completedForBranch.includes(followupId),
    )

    return remainingFollowups.length > 0
      ? remainingFollowups
      : [...CLOSING_NODE_IDS]
  }

  return [...currentNode.transitions]
}
