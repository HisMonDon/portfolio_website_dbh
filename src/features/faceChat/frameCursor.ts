// Ports face_mapping_sandbox/phase5-recording/frameCursor.js verbatim (typed): advances a
// monotonic frame-index cursor through a time-sorted frame array based on an elapsed-time
// reading taken fresh each call, invoking onFrame for every frame whose timestamp is now due.
//
// Re-deriving "which frames are due" from the caller's elapsed-time reading every call — rather
// than accumulating a delta-time clock — is what keeps this immune to drift: if the driving
// clock stalls (a throttled background tab, dropped rAF frames) playback simply pauses along
// with it, and if the clock jumps forward, the next call walks the cursor through every frame
// that fell due in the gap in one pass, rather than lagging behind.
export function advanceFrameCursor<T extends { t: number }>(
  frames: T[],
  frameIndex: number,
  elapsedMs: number,
  onFrame: (frame: T, index: number) => void,
): number {
  let index = frameIndex

  while (index < frames.length && frames[index].t <= elapsedMs) {
    onFrame(frames[index], index)
    index++
  }

  return index
}
