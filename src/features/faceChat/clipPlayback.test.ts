import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __clearClipCacheForTests, findFrameAt, loadClip, type BlendshapeFrame } from './clipPlayback'

describe('findFrameAt (video/audio currentTime-driven frame selection)', () => {
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
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ clipId: 'clip00', frames: [] }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadClip('clip00')).rejects.toThrow(/failed to load \(HTTP 404\)/)

    const data = await loadClip('clip00')
    expect(data.frames).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects when the JSON body is missing a "frames" array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ clipId: 'clip00' }), { status: 200 })),
    )

    await expect(loadClip('clip00')).rejects.toThrow(/malformed/)
  })

  it('caches a successful load so a second call does not re-fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ clipId: 'clip00', frames: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await loadClip('clip00')
    await loadClip('clip00')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
