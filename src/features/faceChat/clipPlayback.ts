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

  const promise = (async () => {
    if (!url) {
      throw new Error(`No clip JSON is registered for clip id "${clipId}".`)
    }

    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`Clip "${clipId}" failed to load (HTTP ${res.status}).`)
    }

    const data = (await res.json()) as ClipData

    if (!data || !Array.isArray(data.frames)) {
      throw new Error(`Clip "${clipId}" JSON is malformed (missing "frames" array).`)
    }

    return data
  })()

  clipCache.set(clipId, promise)

  // A failed load shouldn't be permanently cached — let a later attempt
  // (e.g. after a network hiccup, or once the real asset exists) retry.
  promise.catch(() => clipCache.delete(clipId))

  return promise
}

export function findFrameAt(frames: BlendshapeFrame[], t: number): BlendshapeFrame | null {
  if (frames.length === 0) return null

  let match = frames[0]

  for (const frame of frames) {
    if (frame.t > t) break
    match = frame
  }

  return match
}

export interface ClipPlayerState {
  activeFrame: BlendshapeFrame | null
  error: string | null
}

// Drives clip playback for a given dialogue node's clip id, imperatively
// owning the <video> element passed via `mediaRef`:
//  - On every clipId change, the previous clip is paused and detached
//    (src cleared + reloaded) *before* the next clip's src is attached, so
//    rapid node-to-node navigation never leaves two clips overlapping.
//  - Blendshape frames are looked up from the media element's own
//    `currentTime` (never performance.now()/Date.now()), per the clip
//    format contract.
//  - Both the JSON fetch and the <video> element surface load failures via
//    the returned `error`, instead of throwing/breaking the component.
export function useClipPlayer(
  clipId: string,
  mediaRef: React.RefObject<HTMLVideoElement | null>,
): ClipPlayerState {
  const [clip, setClip] = useState<ClipData | null>(null)
  const [activeFrame, setActiveFrame] = useState<BlendshapeFrame | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let cancelled = false

    setClip(null)
    setActiveFrame(null)
    setError(null)

    const media = mediaRef.current
    const videoUrl = CLIP_VIDEO_URLS[clipId]

    // Stop whatever the previous clip was doing *before* wiring up the new
    // one — avoids any window where two sources could both be playing.
    let handleVideoError: (() => void) | null = null

    if (media) {
      media.pause()
      media.removeAttribute('src')
      media.load()

      handleVideoError = () => {
        if (requestIdRef.current !== requestId) return
        setError((prev) => prev ?? `Clip "${clipId}" video failed to load.`)
      }

      media.addEventListener('error', handleVideoError)

      if (videoUrl) {
        media.src = videoUrl
        media.load()
        media.play().catch(() => {
          /* autoplay rejection is non-fatal; blendshape sync just waits */
        })
      } else {
        setError(`No clip video is registered for clip id "${clipId}".`)
      }
    }

    loadClip(clipId)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) return
        setClip(data)
      })
      .catch((err) => {
        if (cancelled || requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : `Clip "${clipId}" failed to load.`)
      })

    return () => {
      cancelled = true

      if (media && handleVideoError) {
        media.removeEventListener('error', handleVideoError)
      }
    }
  }, [clipId, mediaRef])

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

  return { activeFrame, error }
}
