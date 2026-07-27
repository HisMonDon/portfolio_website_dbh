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

function clipAudioUrl(name: string) {
  return new URL(`./clips/${name}.webm`, import.meta.url).href
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

// Per CLIP_FORMAT.md: every clipNN.json has a paired clipNN.webm recorded at the same time,
// same base name, `t` in the JSON aligned to this audio file's audio.currentTime.
const CLIP_AUDIO_URLS: Record<string, string> = Object.fromEntries(
  Object.keys(CLIP_JSON_URLS).map((clipId) => [clipId, clipAudioUrl(clipId)]),
)

export function getClipAudioUrl(clipId: string): string | null {
  return CLIP_AUDIO_URLS[clipId] ?? null
}

// Idle clips intentionally run on the visual fallback clock with no audio element at all. This
// is separate from `muted`: mute controls answer audio, while idle stays silent even when the
// visitor has unmuted answers.
export function getPlaybackAudioUrl(clipId: string, audioEnabled: boolean): string | null {
  return audioEnabled ? getClipAudioUrl(clipId) : null
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
// target's influence to its frame score. Meshes without morph targets (such as the outfit or
// hair in the avatar GLB) are silently skipped.
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

export interface ClipPlayerOptions {
  audioEnabled?: boolean
  onComplete?: () => void
}

// Per CLIP_FORMAT.md: "Playback MUST be driven by the audio element's audio.currentTime, not
// performance.now() or Date.now()." Picks which elapsed-time source is authoritative right now.
// Exported as a pure function (rather than inlined in the tick loop) so the decision itself is
// unit-testable without a real HTMLAudioElement/rAF.
export function resolveElapsedMs(params: {
  audioCurrentTimeSec: number
  audioHasStarted: boolean
  fallbackElapsedMs: number
}): number {
  return params.audioHasStarted ? params.audioCurrentTimeSec * 1000 : params.fallbackElapsedMs
}

// A clip's elapsed time moving backward between two ticks means playback wrapped (a looping
// audio element's currentTime resetting to ~0, or our own fallback-clock restart below) rather
// than time continuing forward — the frame cursor must be re-derived from 0 in that case, not
// assumed to still be walking forward from wherever it was.
export function didClockWrap(previousElapsedMs: number, nextElapsedMs: number): boolean {
  return nextElapsedMs < previousElapsedMs - 1
}

// Blendshapes + synced audio clip player. Loads clipId's JSON (CLIP_FORMAT.md contract) and its
// paired audio file, and walks the frame array using audio.currentTime as the clock (per the
// contract) so a stalled/throttled rAF can never drift the mouth out of sync with the sound.
// Falls back to a performance.now()-based clock only when audio.play() is rejected (typically
// the very first idle clip on page load, before any user gesture has granted autoplay — see
// browser autoplay policies) so the idle animation still runs visually even without sound; once
// any later clip's audio successfully starts (e.g. after the visitor's first click), playback is
// fully audio-driven again, matching the contract.
// 'loop' mode uses the audio element's native `loop` so the audio and the frame cursor wrap
// together; 'once' mode holds the final frame and stops (for a dialogue answer clip).
export function useClipPlayer(
  clipId: string | null,
  mode: ClipPlayMode,
  isMuted: boolean,
  options: ClipPlayerOptions = {},
): ClipPlayerState {
  const [activeFrame, setActiveFrame] = useState<InternalFrame | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const framesRef = useRef<InternalFrame[]>([])
  const cursorRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioHasStartedRef = useRef(false)
  const fallbackEpochRef = useRef(0)
  const lastElapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const audioEnabled = options.audioEnabled ?? true

  // Completion changes UI state in the caller. Keep the latest callback in a ref so a new inline
  // callback does not restart the current clip on every render.
  const onCompleteRef = useRef(options.onComplete)
  onCompleteRef.current = options.onComplete

  // Read via a ref inside the load effect below so toggling mute never re-triggers a clip
  // reload (that effect intentionally only depends on [clipId, mode]).
  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let cancelled = false

    framesRef.current = []
    cursorRef.current = 0
    audioHasStartedRef.current = false
    fallbackEpochRef.current = 0
    lastElapsedRef.current = 0
    audioRef.current?.pause()
    audioRef.current = null
    setActiveFrame(null)
    setError(null)
    setIsPlaying(false)

    if (!clipId) return

    loadClip(clipId)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) return

        framesRef.current = fromClipFormat(data)
        fallbackEpochRef.current = performance.now()

        const audioUrl = getPlaybackAudioUrl(clipId, audioEnabled)
        const audio = audioUrl ? new Audio(audioUrl) : null

        if (audio) {
          audio.loop = mode === 'loop'
          audio.muted = isMutedRef.current
          audioRef.current = audio

          audio
            .play()
            .then(() => {
              if (cancelled || requestIdRef.current !== requestId) return
              audioHasStartedRef.current = true
            })
            .catch(() => {
              // Autoplay blocked (no user gesture yet) — fall back to the performance.now()
              // clock below so the visible animation still plays; audioHasStartedRef stays
              // false, so this clip simply plays silently.
            })
        }

        setIsPlaying(true)
      })
      .catch((err) => {
        if (cancelled || requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : `Clip "${clipId}" failed to load.`)
      })

    return () => {
      cancelled = true
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [audioEnabled, clipId, mode])

  // Applied to whatever audio element is current, independent of the clip-load effect above.
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted
  }, [isMuted])

  useEffect(() => {
    if (!isPlaying) return

    const tick = () => {
      const frames = framesRef.current

      if (frames.length === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const audio = audioRef.current
      const elapsedMs = resolveElapsedMs({
        audioCurrentTimeSec: audio?.currentTime ?? 0,
        audioHasStarted: audioHasStartedRef.current,
        fallbackElapsedMs: performance.now() - fallbackEpochRef.current,
      })

      if (didClockWrap(lastElapsedRef.current, elapsedMs)) {
        cursorRef.current = 0
      }
      lastElapsedRef.current = elapsedMs

      const lastFrameT = frames[frames.length - 1].t

      // Answer audio can be a little longer than the final tracking sample. Hold the final face
      // until the audio itself ends so entering idle never clips the last syllable. If a malformed
      // audio file ends early, also finish cleanly instead of waiting on a stopped clock forever.
      if (mode === 'once' && audioHasStartedRef.current && audio?.ended) {
        cursorRef.current = advanceFrameCursor(frames, cursorRef.current, lastFrameT, (frame) => {
          setActiveFrame(frame)
        })
        setIsPlaying(false)
        onCompleteRef.current?.()
        return
      }

      if (elapsedMs >= lastFrameT) {
        cursorRef.current = advanceFrameCursor(frames, cursorRef.current, lastFrameT, (frame) => {
          setActiveFrame(frame)
        })

        if (mode === 'once' && !audioHasStartedRef.current) {
          audio?.pause()
          setIsPlaying(false)
          onCompleteRef.current?.()
          return
        }

        // Loop mode: a native-looping audio element wraps currentTime on its own (the next
        // tick's didClockWrap check picks that up); the fallback clock has no such mechanism
        // and must be restarted by hand.
        if (!audioHasStartedRef.current) {
          fallbackEpochRef.current = performance.now()
          lastElapsedRef.current = 0
          cursorRef.current = 0
        }
      } else {
        cursorRef.current = advanceFrameCursor(frames, cursorRef.current, elapsedMs, (frame) => {
          setActiveFrame(frame)
        })
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

    audioRef.current?.play().catch(() => {})
    setIsPlaying(true)
  }

  const pause = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  return { activeFrame, isPlaying, error, play, pause }
}
