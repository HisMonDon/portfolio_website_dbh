// Dialogue state machine data for the face-tracking avatar chat feature.
//
// STRUCTURE ASSUMPTION (documented per spec — re-map here if wrong):
// The source spec asked for "16 nodes: 4 opening questions (level 0), 8
// follow-ups (level 1, 2 per opening), 3 shared closing nodes (level 2,
// reconverged into from any level-1 node), plus 1 additional 'loop' node
// reachable from the closings that offers to restart at level 0."
// That is ambiguous about exactly which follow-ups feed which closings and
// whether the loop node counts as a 4th closing. This file resolves it as:
//   - Nodes 1-4   : openings (level 0)
//   - Nodes 5-12  : follow-ups (level 1), 2 per opening in order
//                   (1 -> 5,6) (2 -> 7,8) (3 -> 9,10) (4 -> 11,12)
//   - Nodes 13,15,16 : the 3 shared closings (level 2) — every level-1 node
//                   transitions to all three, so the user picks which
//                   closing to hear.
//   - Node 14     : the distinct "loop" node, NOT counted among the 3
//                   closings. All three closings (13, 15, 16) transition to
//                   it, and its own script line offers to jump back to the
//                   4 opening questions, restarting the level-0 selection.
// Total: 4 + 8 + 3 + 1 = 16 nodes.
//
// This graph is intentionally data-only. Swapping in real per-node clips
// later (clipNN.webm / clipNN.json pairs, per CLIP_FORMAT.md) should only
// require changing `clipId` below — no component/logic changes.

export type DialogueNodeType = 'opening' | 'followup' | 'closing' | 'loop'

export interface DialogueNode {
  id: number
  type: DialogueNodeType
  clipId: string
  transitions: number[]
}

// All 16 nodes currently point at the same placeholder clip pair
// (clip00.webm / clip00.json) until real per-node recordings exist.
const PLACEHOLDER_CLIP_ID = 'clip00'

export const OPENING_NODE_IDS = [1, 2, 3, 4] as const
export const CLOSING_NODE_IDS = [13, 15, 16] as const
export const LOOP_NODE_ID = 14 as const

export const DIALOGUE_GRAPH: Record<number, DialogueNode> = {
  1: { id: 1, type: 'opening', clipId: PLACEHOLDER_CLIP_ID, transitions: [5, 6] },
  2: { id: 2, type: 'opening', clipId: PLACEHOLDER_CLIP_ID, transitions: [7, 8] },
  3: { id: 3, type: 'opening', clipId: PLACEHOLDER_CLIP_ID, transitions: [9, 10] },
  4: { id: 4, type: 'opening', clipId: PLACEHOLDER_CLIP_ID, transitions: [11, 12] },

  5: { id: 5, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  6: { id: 6, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  7: { id: 7, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  8: { id: 8, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  9: { id: 9, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  10: { id: 10, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  11: { id: 11, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },
  12: { id: 12, type: 'followup', clipId: PLACEHOLDER_CLIP_ID, transitions: [13, 15, 16] },

  13: { id: 13, type: 'closing', clipId: PLACEHOLDER_CLIP_ID, transitions: [14] },
  15: { id: 15, type: 'closing', clipId: PLACEHOLDER_CLIP_ID, transitions: [14] },
  16: { id: 16, type: 'closing', clipId: PLACEHOLDER_CLIP_ID, transitions: [14] },

  // Loop/meta node: hands control back to the 4 opening questions.
  14: { id: 14, type: 'loop', clipId: PLACEHOLDER_CLIP_ID, transitions: [1, 2, 3, 4] },
}

export function getDialogueNode(id: number): DialogueNode {
  const node = DIALOGUE_GRAPH[id]

  if (!node) {
    throw new Error(`Unknown dialogue node id: ${id}`)
  }

  return node
}
