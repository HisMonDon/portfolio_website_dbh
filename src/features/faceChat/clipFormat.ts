// Converts between the CLIP_FORMAT.md contract (shared with face_mapping_sandbox) and this
// player's internal frame representation. Mirrors
// face_mapping_sandbox/phase5-recording/clipExport.js exactly, so a clip produced by that repo's
// toClipFormat() round-trips through this file's fromClipFormat() into the same shape its own
// applyBlendshapes(categories, meshes) expects.
//
// CLIP_FORMAT.md contract (clipNN.json on disk): `t` in seconds aligned to a paired
// clipNN.webm/.m4a's audio.currentTime, `blendshapes: [{ name, score }]`.
// Internal shape (what the frame-cursor/playback loop below walks): `t` in milliseconds,
// `categories: [{ categoryName, score }]` — matching the sandbox's own internal representation.
export type RecordedQuaternion = [number, number, number, number]
export type RecordedPosition = [number, number, number]

export interface RecordedPose {
  bones: Record<string, RecordedQuaternion>
  rootPosition?: RecordedPosition
}

export interface ClipFormatFrame {
  t: number
  blendshapes: { name: string; score: number }[]
  pose?: RecordedPose
}

export interface InternalFrame {
  t: number
  categories: { categoryName: string; score: number }[]
  pose?: RecordedPose
}

export function toClipFormat(internalFrames: InternalFrame[]): ClipFormatFrame[] {
  return internalFrames.map((frame) => ({
    t: frame.t / 1000,
    blendshapes: frame.categories.map((c) => ({ name: c.categoryName, score: c.score })),
    ...(frame.pose ? { pose: frame.pose } : {}),
  }))
}

export function fromClipFormat(clipFormatFrames: ClipFormatFrame[]): InternalFrame[] {
  return clipFormatFrames.map((frame) => ({
    t: frame.t * 1000,
    categories: frame.blendshapes.map((b) => ({ categoryName: b.name, score: b.score })),
    ...(frame.pose ? { pose: frame.pose } : {}),
  }))
}
