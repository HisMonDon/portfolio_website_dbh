import { useEffect, useRef, useState } from 'react'
import { advanceFrameCursor } from './frameCursor'
import { fromClipFormat, type ClipFormatFrame, type InternalFrame } from './clipFormat'

export type BlendshapeFrame = ClipFormatFrame

// Per CLIP_FORMAT.md, clipNN.json on disk is a bare JSON array of frames — no wrapping object,
// no clipId field in the file.
export type ClipData = ClipFormatFrame[]

const clipCache = new Map<string, Promise<ClipData>>()

function clipUrl(name: string) {
  return new URL(`./clips/${name}.json`, import.meta.url).href
}

// Recorded per-node dialogue clips (see dialogueGraph.ts) plus the idle loop and clips reserved
// for other portfolio sections (intro/credits/resume/skills) not yet wired up outside this
// project card.
const CLIP_JSON_URLS: Record<string, string> = {
  '0_1': clipUrl('0_1'),
  '0_2': clipUrl('0_2'),
  '0_3': clipUrl('0_3'),
  '0_4': clipUrl('0_4'),
  '1_0': clipUrl('1_0'),
  '1_1': clipUrl('1_1'),
  '2_0': clipUrl('2_0'),
  '2_1': clipUrl('2_1'),
  '3_0': clipUrl('3_0'),
  '3_1': clipUrl('3_1'),
  '4_0': clipUrl('4_0'),
  '4_1': clipUrl('4_1'),
  '4_2': clipUrl('4_2'),
  '4_3': clipUrl('4_3'),
  last_0: clipUrl('last_0'),
  last_1: clipUrl('last_1'),
  idle_0: clipUrl('idle_0'),
  idle_1: clipUrl('idle_1'),
  intro: clipUrl('intro'),
  credits: clipUrl('credits'),
  resume: clipUrl('resume'),
  skills: clipUrl('skills'),
}

// Test-only escape hatch so unit tests can exercise loadClip's error/retry paths against the
// same clip id without cross-test cache pollution.
export function __clearClipCacheForTests(): void {
  clipCache.clear()
}

export function loadClip(clipId: string): Promise<ClipData> {
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

    if (!Array.isArray(data)) {
      throw new Error(`Clip "${clipId}" JSON is malformed (expected an array of frames).`)
    }

    return data
  })()

  clipCache.set(clipId, promise)

  // A failed load shouldn't be permanently cached — let a later attempt (e.g. after a network
  // hiccup, or once the real asset exists) retry.
  promise.catch(() => clipCache.delete(clipId))

  return promise
}

// Finds the latest CLIP_FORMAT-shaped frame at-or-before a given time (seconds). Kept for
// callers that want a one-off lookup against the raw seconds/name contract; the live playback
// loop below walks the internal ms/categoryName frames via advanceFrameCursor instead.
export function findFrameAt(frames: ClipFormatFrame[], t: number): ClipFormatFrame | null {
  if (frames.length === 0) return null

  let match = frames[0]

  for (const frame of frames) {
    if (frame.t > t) break
    match = frame
  }

  return match
}

// Duck-typed rather than importing three.js here, so this file (and its round-trip/edge-case
// tests) stay usable outside a WebGL context.
interface MorphableMesh {
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[]
}

// Mirrors face_mapping_sandbox's applyBlendshapes(categories, meshes): sets each named morph
// target's influence to its frame score. A mesh without morph targets (e.g. this repo's current
// placeholder avatar) is silently skipped — this is the hookup point for once a real
// morph-target avatar model replaces the placeholder.
export function applyBlendshapesToMeshes(
  categories: { categoryName: string; score: number }[],
  meshes: MorphableMesh[],
): void {
  meshes.forEach((mesh) => {
    const dict = mesh.morphTargetDictionary
    const influences = mesh.morphTargetInfluences

    if (!dict || !influences) return

    categories.forEach(({ categoryName, score }) => {
      const index = dict[categoryName]

      if (index !== undefined) influences[index] = score
    })
  })
}

export type ClipPlayMode = 'loop' | 'once'

export interface ClipPlayerState {
  activeFrame: InternalFrame | null
  isPlaying: boolean
  error: string | null
  play: () => void
  pause: () => void
}

// Blendshapes-only clip player: loads clipId's JSON (CLIP_FORMAT.md contract) and walks its
// frames on a plain rAF clock (no audio/video element — this repo has no audio to sync to yet).
// 'loop' mode restarts from t=0 once the clip's last frame passes (for an idle clip); 'once'
// mode holds the final frame and stops (for a dialogue answer clip).
export function useClipPlayer(clipId: string | null, mode: ClipPlayMode): ClipPlayerState {
  const [activeFrame, setActiveFrame] = useState<InternalFrame | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const framesRef = useRef<InternalFrame[]>([])
  const cursorRef = useRef(0)
  const epochRef = useRef<number | null>(null)
  const pausedElapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let cancelled = false

    framesRef.current = []
    cursorRef.current = 0
    epochRef.current = null
    pausedElapsedRef.current = 0
    setActiveFrame(null)
    setError(null)
    setIsPlaying(false)

    if (!clipId) return

    loadClip(clipId)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) return

        framesRef.current = fromClipFormat(data)
        epochRef.current = performance.now()
        setIsPlaying(true)
      })
      .catch((err) => {
        if (cancelled || requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : `Clip "${clipId}" failed to load.`)
      })

    return () => {
      cancelled = true
    }
  }, [clipId])

  useEffect(() => {
    if (!isPlaying) return

    const tick = () => {
      const frames = framesRef.current
      const epoch = epochRef.current

      if (frames.length > 0 && epoch !== null) {
        const lastFrameT = frames[frames.length - 1].t
        const elapsedMs = performance.now() - epoch

        if (elapsedMs > lastFrameT) {
          cursorRef.current = advanceFrameCursor(frames, cursorRef.current, lastFrameT, (frame) => {
            setActiveFrame(frame)
          })

          if (mode === 'loop') {
            // Re-derive from a fresh epoch rather than accumulating drift across loops.
            epochRef.current = performance.now()
            cursorRef.current = 0
          } else {
            setIsPlaying(false)
            return
          }
        } else {
          cursorRef.current = advanceFrameCursor(frames, cursorRef.current, elapsedMs, (frame) => {
            setActiveFrame(frame)
          })
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isPlaying, mode])

  const play = () => {
    if (framesRef.current.length === 0) return

    epochRef.current = performance.now() - pausedElapsedRef.current
    setIsPlaying(true)
  }

  const pause = () => {
    if (epochRef.current !== null) {
      pausedElapsedRef.current = performance.now() - epochRef.current
    }

    setIsPlaying(false)
  }

  return { activeFrame, isPlaying, error, play, pause }
}
