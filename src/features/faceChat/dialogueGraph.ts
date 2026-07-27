// Dialogue state machine data for the face-tracking avatar chat feature.
//
// Structure, per the recorded clip set in ./clips (file basenames = clipId below):
//   - Nodes 1-4    : openings (level 0) — 0_1..0_4
//   - Nodes 5-13   : follow-ups (level 1) — 2 each under openings 1-3, 3 under opening 4
//                    (1 -> 5,6) (2 -> 7,8) (3 -> 9,10) (4 -> 11,12,13)
//                    (node 14, "Who do you look up to?" / clip 4_3, was cut — no answer
//                    recorded for it)
//   - Nodes 17,18  : the 2 shared closings (level 2) — last_0, last_1. Every level-1 node
//                    transitions to both, so the user picks which closing to hear.
//   - Node 19      : the "loop" node — reachable from both closings, offers to jump back to the
//                    4 opening questions. Uses the idle clip (no dedicated recording exists for
//                    this transitional line).
// Total: 4 + 9 + 2 + 1 = 16 nodes.
export type DialogueNodeType = 'opening' | 'followup' | 'closing' | 'loop'

export interface DialogueNode {
  id: number
  type: DialogueNodeType
  clipId: string
  transitions: number[]
}

export const OPENING_NODE_IDS = [1, 2, 3, 4] as const
export const CLOSING_NODE_IDS = [17, 18] as const
export const LOOP_NODE_ID = 19 as const

// The avatar idles on this clip (looped) until the user makes their first selection — see
// FaceChatWidget.tsx.
export const IDLE_CLIP_IDS = ['idle_0', 'idle_1'] as const
export const IDLE_CLIP_ID = IDLE_CLIP_IDS[0]

const CLOSING_TRANSITIONS = [...CLOSING_NODE_IDS]

export const DIALOGUE_GRAPH: Record<number, DialogueNode> = {
  1: { id: 1, type: 'opening', clipId: '0_1', transitions: [5, 6] },
  2: { id: 2, type: 'opening', clipId: '0_2', transitions: [7, 8] },
  3: { id: 3, type: 'opening', clipId: '0_3', transitions: [9, 10] },
  4: { id: 4, type: 'opening', clipId: '0_4', transitions: [11, 12, 13] },

  5: { id: 5, type: 'followup', clipId: '1_0', transitions: CLOSING_TRANSITIONS },
  6: { id: 6, type: 'followup', clipId: '1_1', transitions: CLOSING_TRANSITIONS },
  7: { id: 7, type: 'followup', clipId: '2_0', transitions: CLOSING_TRANSITIONS },
  8: { id: 8, type: 'followup', clipId: '2_1', transitions: CLOSING_TRANSITIONS },
  9: { id: 9, type: 'followup', clipId: '3_0', transitions: CLOSING_TRANSITIONS },
  10: { id: 10, type: 'followup', clipId: '3_1', transitions: CLOSING_TRANSITIONS },
  11: { id: 11, type: 'followup', clipId: '4_0', transitions: CLOSING_TRANSITIONS },
  12: { id: 12, type: 'followup', clipId: '4_1', transitions: CLOSING_TRANSITIONS },
  13: { id: 13, type: 'followup', clipId: '4_2', transitions: CLOSING_TRANSITIONS },

  17: { id: 17, type: 'closing', clipId: 'last_0', transitions: [19] },
  18: { id: 18, type: 'closing', clipId: 'last_1', transitions: [19] },

  19: { id: 19, type: 'loop', clipId: IDLE_CLIP_ID, transitions: [1, 2, 3, 4] },
}

export function getDialogueNode(id: number): DialogueNode {
  const node = DIALOGUE_GRAPH[id]

  if (!node) {
    throw new Error(`Unknown dialogue node id: ${id}`)
  }

  return node
}
