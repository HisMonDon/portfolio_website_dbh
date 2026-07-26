import { useEffect, useRef, useState } from 'react'

export interface BlendshapeFrame {
  t: number
  blendshapes: { name: string; score: number }[]
}

export interface ClipData {
  clipId: string
  frames: BlendshapeFrame[]
}

const clipCache = new Map<string, Promise<ClipData>>()

// Placeholder clip assets are bundled statically today (clip00.webm /
// clip00.json). Real per-node clips would be fetched by NN index the same
// way — only this lookup needs to change, not the playback logic below.
const CLIP_JSON_URLS: Record<string, string> = {
  clip00: new URL('./clips/clip00.json', import.meta.url).href,
}

export const CLIP_VIDEO_URLS: Record<string, string> = {
  clip00: new URL('./clips/clip00.webm', import.meta.url).href,
}

function loadClip(clipId: string): Promise<ClipData> {
  const cached = clipCache.get(clipId)

  if (cached) return cached

  const url = CLIP_JSON_URLS[clipId]
  const promise = fetch(url).then((res) => res.json()) as Promise<ClipData>

  clipCache.set(clipId, promise)
  return promise
}

function findFrameAt(frames: BlendshapeFrame[], t: number): BlendshapeFrame | null {
  if (frames.length === 0) return null

  let match = frames[0]

  for (const frame of frames) {
    if (frame.t > t) break
    match = frame
  }

  return match
}

// Drives blendshape playback from the media element's own `currentTime`
// (never performance.now()/Date.now()), per the clip format contract: the
// active frame is whichever blendshape sample's timestamp is the latest one
// at or before the video's current playback position.
export function useClipBlendshapes(
  clipId: string,
  mediaRef: React.RefObject<HTMLVideoElement | null>,
) {
  const [clip, setClip] = useState<ClipData | null>(null)
  const [activeFrame, setActiveFrame] = useState<BlendshapeFrame | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setClip(null)
    setActiveFrame(null)

    loadClip(clipId).then((data) => {
      if (!cancelled) setClip(data)
    })

    return () => {
      cancelled = true
    }
  }, [clipId])

  useEffect(() => {
    if (!clip) return

    const tick = () => {
      const media = mediaRef.current

      if (media) {
        setActiveFrame(findFrameAt(clip.frames, media.currentTime))
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [clip, mediaRef])

  return activeFrame
}
