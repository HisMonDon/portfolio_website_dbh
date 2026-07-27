import { useCallback, useEffect, useRef, useState } from 'react'
import { advanceFrameCursor } from './frameCursor'
import { fromClipFormat, type ClipFormatFrame, type InternalFrame } from './clipFormat'
import {
  CLIP_TRANSITION_DURATION_MS,
  interpolateInternalFrames,
} from './frameTransition'

export type BlendshapeFrame = ClipFormatFrame
export type ClipData = ClipFormatFrame[]

const clipCache = new Map<string, Promise<ClipData>>()

function clipUrl(name: string) {
  return new URL(`./clips/${name}.json`, import.meta.url).href
}

function clipAudioUrl(name: string) {
  return new URL(`./clips/${name}.webm`, import.meta.url).href
}

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

const CLIP_AUDIO_URLS: Record<string, string> = Object.fromEntries(
  Object.keys(CLIP_JSON_URLS).map((clipId) => [clipId, clipAudioUrl(clipId)]),
)

export function getClipAudioUrl(clipId: string): string | null {
  return CLIP_AUDIO_URLS[clipId] ?? null
}

// Idle is visual-only. Returning null here prevents an Audio element from being created at all.
export function getPlaybackAudioUrl(clipId: string, audioEnabled: boolean): string | null {
  return audioEnabled ? getClipAudioUrl(clipId) : null
}

export function __clearClipCacheForTests(): void {
  clipCache.clear()
}

export function loadClip(clipId: string): Promise<ClipData> {
  const cached = clipCache.get(clipId)

  if (cached) return cached

  const url = CLIP_JSON_URLS[clipId]
  const promise = (async () => {
    if (!url) throw new Error(`No clip JSON is registered for clip id "${clipId}".`)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Clip "${clipId}" failed to load (HTTP ${response.status}).`)
    }

    const data = (await response.json()) as ClipData

    if (!Array.isArray(data)) {
      throw new Error(`Clip "${clipId}" JSON is malformed (expected an array of frames).`)
    }

    return data
  })()

  clipCache.set(clipId, promise)
  promise.catch(() => clipCache.delete(clipId))
  return promise
}

export function findFrameAt(frames: ClipFormatFrame[], timeSeconds: number): ClipFormatFrame | null {
  if (frames.length === 0) return null

  let match = frames[0]

  for (const frame of frames) {
    if (frame.t > timeSeconds) break
    match = frame
  }

  return match
}

interface MorphableMesh {
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[]
}

export function applyBlendshapesToMeshes(
  categories: { categoryName: string; score: number }[],
  meshes: MorphableMesh[],
): void {
  meshes.forEach((mesh) => {
    const dictionary = mesh.morphTargetDictionary
    const influences = mesh.morphTargetInfluences

    if (!dictionary || !influences) return

    categories.forEach(({ categoryName, score }) => {
      const index = dictionary[categoryName]
      if (index !== undefined) influences[index] = score
    })
  })
}

export type ClipPlayMode = 'loop' | 'once'
export type ClipCompletionReason = 'ended' | 'skipped'

export interface ClipPlayerState {
  activeFrame: InternalFrame | null
  isPlaying: boolean
  error: string | null
  playbackClipId: string | null
  playbackTimeMs: number
  playbackProgress: number
  play: () => void
  pause: () => void
  skip: () => void
}

export interface ClipPlayerOptions {
  audioEnabled?: boolean
  onComplete?: (reason: ClipCompletionReason) => void
  transitionDurationMs?: number
}

export function resolveElapsedMs(params: {
  audioCurrentTimeSec: number
  audioHasStarted: boolean
  fallbackElapsedMs: number
}): number {
  return params.audioHasStarted ? params.audioCurrentTimeSec * 1000 : params.fallbackElapsedMs
}

export function didClockWrap(previousElapsedMs: number, nextElapsedMs: number): boolean {
  return nextElapsedMs < previousElapsedMs - 1
}

export function resolvePlaybackProgress(params: {
  elapsedMs: number
  audioDurationSec: number
  audioHasStarted: boolean
  fallbackDurationMs: number
}): number {
  const audioDurationMs = params.audioDurationSec * 1000
  const durationMs = params.audioHasStarted && Number.isFinite(audioDurationMs) && audioDurationMs > 0
    ? audioDurationMs
    : params.fallbackDurationMs

  if (durationMs <= 0) return 0

  return Math.min(Math.max(params.elapsedMs / durationMs, 0), 1)
}

// Audio drives every spoken clip. A performance clock is used only for intentionally silent idle
// clips or when browser autoplay rejects an answer. Before either clock begins, a short bridge
// interpolates the currently displayed frame into the new file's first frame.
export function useClipPlayer(
  clipId: string | null,
  mode: ClipPlayMode,
  isMuted: boolean,
  options: ClipPlayerOptions = {},
): ClipPlayerState {
  const [activeFrame, setActiveFrame] = useState<InternalFrame | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playbackClipId, setPlaybackClipId] = useState<string | null>(clipId)
  const [playbackTimeMs, setPlaybackTimeMs] = useState(0)
  const [playbackProgress, setPlaybackProgress] = useState(0)

  const framesRef = useRef<InternalFrame[]>([])
  const cursorRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioHasStartedRef = useRef(false)
  const fallbackEpochRef = useRef(0)
  const lastElapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const transitionRafRef = useRef<number | null>(null)
  const activeFrameRef = useRef<InternalFrame | null>(null)
  const requestIdRef = useRef(0)
  const completionFiredRef = useRef(false)

  const audioEnabled = options.audioEnabled ?? true
  const transitionDurationMs = options.transitionDurationMs ?? CLIP_TRANSITION_DURATION_MS

  const displayFrame = useCallback((frame: InternalFrame) => {
    activeFrameRef.current = frame
    setActiveFrame(frame)
  }, [])

  const displayPlaybackProgress = useCallback((progress: number) => {
    setPlaybackProgress((current) =>
      Math.abs(current - progress) >= 0.002 || progress === 0 || progress === 1
        ? progress
        : current,
    )
  }, [])

  const displayPlaybackTime = useCallback((elapsedMs: number) => {
    setPlaybackTimeMs((current) =>
      Math.abs(current - elapsedMs) >= 8 || elapsedMs === 0
        ? elapsedMs
        : current,
    )
  }, [])

  const onCompleteRef = useRef(options.onComplete)
  onCompleteRef.current = options.onComplete

  const isMutedRef = useRef(isMuted)
  isMutedRef.current = isMuted

  const completePlayback = useCallback((reason: ClipCompletionReason) => {
    if (mode !== 'once' || completionFiredRef.current) return

    completionFiredRef.current = true

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (transitionRafRef.current !== null) cancelAnimationFrame(transitionRafRef.current)
    rafRef.current = null
    transitionRafRef.current = null

    const audio = audioRef.current
    const frames = framesRef.current
    const lastFrame = frames[frames.length - 1]
    const lastFrameTime = lastFrame?.t ?? 0

    audio?.pause()
    audioRef.current = null
    audioHasStartedRef.current = false

    if (lastFrame) {
      cursorRef.current = frames.length
      displayFrame(lastFrame)
    }

    displayPlaybackTime(
      audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000
        : lastFrameTime,
    )
    displayPlaybackProgress(1)
    setIsPlaying(false)
    onCompleteRef.current?.(reason)
  }, [displayFrame, displayPlaybackProgress, displayPlaybackTime, mode])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const outgoingFrame = activeFrameRef.current
    let cancelled = false

    framesRef.current = []
    cursorRef.current = 0
    audioHasStartedRef.current = false
    fallbackEpochRef.current = 0
    lastElapsedRef.current = 0
    completionFiredRef.current = false
    audioRef.current?.pause()
    audioRef.current = null
    if (transitionRafRef.current !== null) cancelAnimationFrame(transitionRafRef.current)
    transitionRafRef.current = null
    setError(null)
    setIsPlaying(false)
    setPlaybackClipId(clipId)
    displayPlaybackTime(0)
    displayPlaybackProgress(0)

    if (!clipId) {
      activeFrameRef.current = null
      setActiveFrame(null)
      return
    }

    loadClip(clipId)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) return

        const frames = fromClipFormat(data)
        const firstFrame = frames[0]

        if (!firstFrame) throw new Error(`Clip "${clipId}" has no animation frames.`)

        framesRef.current = frames

        const beginPlayback = () => {
          if (cancelled || requestIdRef.current !== requestId) return

          cursorRef.current = 0
          lastElapsedRef.current = 0
          fallbackEpochRef.current = performance.now()
          displayPlaybackTime(0)
          displayPlaybackProgress(0)

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
                // Keep visuals moving on the fallback clock if autoplay is unavailable.
              })
          }

          setIsPlaying(true)
        }

        if (!outgoingFrame || transitionDurationMs <= 0) {
          displayFrame(firstFrame)
          beginPlayback()
          return
        }

        const transitionStartedAt = performance.now()
        const tickTransition = (nowMs: number) => {
          if (cancelled || requestIdRef.current !== requestId) return

          const progress = (nowMs - transitionStartedAt) / transitionDurationMs
          displayFrame(interpolateInternalFrames(outgoingFrame, firstFrame, progress))

          if (progress < 1) {
            transitionRafRef.current = requestAnimationFrame(tickTransition)
            return
          }

          transitionRafRef.current = null
          displayFrame(firstFrame)
          beginPlayback()
        }

        transitionRafRef.current = requestAnimationFrame(tickTransition)
      })
      .catch((loadError) => {
        if (cancelled || requestIdRef.current !== requestId) return
        setError(loadError instanceof Error ? loadError.message : `Clip "${clipId}" failed to load.`)
      })

    return () => {
      cancelled = true
      if (transitionRafRef.current !== null) cancelAnimationFrame(transitionRafRef.current)
      transitionRafRef.current = null
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [
    audioEnabled,
    clipId,
    displayFrame,
    displayPlaybackProgress,
    displayPlaybackTime,
    mode,
    transitionDurationMs,
  ])

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

      if (didClockWrap(lastElapsedRef.current, elapsedMs)) cursorRef.current = 0
      lastElapsedRef.current = elapsedMs
      displayPlaybackTime(elapsedMs)

      const lastFrameTime = frames[frames.length - 1].t
      displayPlaybackProgress(resolvePlaybackProgress({
        elapsedMs,
        audioDurationSec: audio?.duration ?? Number.NaN,
        audioHasStarted: audioHasStartedRef.current,
        fallbackDurationMs: lastFrameTime,
      }))

      // Hold the final tracked expression until the answer audio ends, so the last syllable is
      // never cut off when the widget switches back to idle.
      if (mode === 'once' && audioHasStartedRef.current && audio?.ended) {
        completePlayback('ended')
        return
      }

      if (elapsedMs >= lastFrameTime) {
        cursorRef.current = advanceFrameCursor(
          frames,
          cursorRef.current,
          lastFrameTime,
          displayFrame,
        )

        if (mode === 'once' && !audioHasStartedRef.current) {
          completePlayback('ended')
          return
        }

        if (!audioHasStartedRef.current) {
          fallbackEpochRef.current = performance.now()
          lastElapsedRef.current = 0
          cursorRef.current = 0
        }
      } else {
        cursorRef.current = advanceFrameCursor(
          frames,
          cursorRef.current,
          elapsedMs,
          displayFrame,
        )
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [completePlayback, displayFrame, displayPlaybackProgress, displayPlaybackTime, isPlaying, mode])

  const play = () => {
    if (framesRef.current.length === 0) return
    audioRef.current?.play().catch(() => {})
    setIsPlaying(true)
  }

  const pause = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  const skip = useCallback(() => {
    completePlayback('skipped')
  }, [completePlayback])

  return {
    activeFrame,
    isPlaying,
    error,
    playbackClipId,
    playbackTimeMs,
    playbackProgress,
    play,
    pause,
    skip,
  }
}
