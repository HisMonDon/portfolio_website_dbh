import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __clearClipCacheForTests,
  didClockWrap,
  findFrameAt,
  getPlaybackAudioUrl,
  loadClip,
  resolveElapsedMs,
  resolvePlaybackProgress,
  type BlendshapeFrame,
} from './clipPlayback'

describe('getPlaybackAudioUrl', () => {
  it('does not expose or create an audio source for silent idle playback', () => {
    expect(getPlaybackAudioUrl('idle_0', false)).toBeNull()
    expect(getPlaybackAudioUrl('idle_1', false)).toBeNull()
  })

  it('keeps the paired recording available for spoken answer playback', () => {
    expect(getPlaybackAudioUrl('0_1', true)).toMatch(/0_1\.webm/)
  })
})

describe('findFrameAt (latest CLIP_FORMAT frame at-or-before a given time)', () => {
  const frames: BlendshapeFrame[] = [
    { t: 0, blendshapes: [{ name: 'jawOpen', score: 0 }] },
    { t: 1, blendshapes: [{ name: 'jawOpen', score: 0.2 }] },
    { t: 2.5, blendshapes: [{ name: 'jawOpen', score: 0.4 }] },
  ]

  it('returns null when there are no frames', () => {
    expect(findFrameAt([], 5)).toBeNull()
  })

  it('falls back to the first frame when the time is before every frame', () => {
    expect(findFrameAt(frames, -1)).toBe(frames[0])
  })

  it('returns the frame exactly matching the given time', () => {
    expect(findFrameAt(frames, 1)).toBe(frames[1])
  })

  it('returns the latest frame at-or-before the given time (not the nearest)', () => {
    // 1.9 is closer to the frame at t=2.5, but the contract is "latest frame
    // at-or-before now", matching how clip playback should never show a
    // blendshape sample from the future.
    expect(findFrameAt(frames, 1.9)).toBe(frames[1])
  })

  it('returns the last frame once playback time passes the final sample', () => {
    expect(findFrameAt(frames, 100)).toBe(frames[2])
  })
})

describe('resolveElapsedMs (CLIP_FORMAT.md: audio.currentTime drives playback when available)', () => {
  it('uses audio.currentTime (converted to ms) once audio has started', () => {
    const elapsed = resolveElapsedMs({
      audioCurrentTimeSec: 1.5,
      audioHasStarted: true,
      fallbackElapsedMs: 999,
    })

    expect(elapsed).toBe(1500)
  })

  it('falls back to the performance.now()-based clock when audio has not started', () => {
    const elapsed = resolveElapsedMs({
      audioCurrentTimeSec: 1.5,
      audioHasStarted: false,
      fallbackElapsedMs: 250,
    })

    expect(elapsed).toBe(250)
  })
})

describe('didClockWrap (detects a loop restart between two ticks)', () => {
  it('returns false when elapsed time is moving forward', () => {
    expect(didClockWrap(100, 150)).toBe(false)
  })

  it('returns false for the same elapsed time', () => {
    expect(didClockWrap(100, 100)).toBe(false)
  })

  it('returns true when elapsed time moves backward (a loop wrap)', () => {
    expect(didClockWrap(4000, 5)).toBe(true)
  })

  it('tolerates a tiny backward jitter (not a real wrap) via its 1ms margin', () => {
    expect(didClockWrap(100, 99.5)).toBe(false)
  })
})

describe('resolvePlaybackProgress', () => {
  it('uses the spoken audio duration when audio is driving playback', () => {
    expect(resolvePlaybackProgress({
      elapsedMs: 1500,
      audioDurationSec: 3,
      audioHasStarted: true,
      fallbackDurationMs: 2000,
    })).toBe(0.5)
  })

  it('uses the animation duration for silent or unavailable audio', () => {
    expect(resolvePlaybackProgress({
      elapsedMs: 500,
      audioDurationSec: Number.NaN,
      audioHasStarted: false,
      fallbackDurationMs: 2000,
    })).toBe(0.25)
  })

  it('clamps progress to the playback range', () => {
    expect(resolvePlaybackProgress({
      elapsedMs: 5000,
      audioDurationSec: 2,
      audioHasStarted: true,
      fallbackDurationMs: 2000,
    })).toBe(1)
  })
})

describe('loadClip', () => {
  beforeEach(() => {
    __clearClipCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects with a clear error for an unregistered clip id, without touching fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await expect(loadClip('__not_a_real_clip__')).rejects.toThrow(/No clip JSON is registered/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects on a non-ok HTTP response and evicts the cache so a later call retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadClip('0_1')).rejects.toThrow(/failed to load \(HTTP 404\)/)

    const data = await loadClip('0_1')
    expect(data).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects when the JSON body is not an array of frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ notAnArray: true }), { status: 200 })),
    )

    await expect(loadClip('0_1')).rejects.toThrow(/malformed/)
  })

  it('caches a successful load so a second call does not re-fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await loadClip('0_1')
    await loadClip('0_1')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
