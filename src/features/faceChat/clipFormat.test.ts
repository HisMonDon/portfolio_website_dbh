import { describe, expect, it } from 'vitest'
import { fromClipFormat, toClipFormat, type ClipFormatFrame, type InternalFrame } from './clipFormat'

describe('fromClipFormat (CLIP_FORMAT.md contract -> internal ms/categoryName shape)', () => {
  it('returns an empty array for an empty frame list', () => {
    expect(fromClipFormat([])).toEqual([])
  })

  it('converts seconds to milliseconds and renames blendshapes -> categories/name -> categoryName', () => {
    const input: ClipFormatFrame[] = [
      { t: 0, blendshapes: [{ name: 'jawOpen', score: 0.02 }, { name: 'mouthSmileLeft', score: 0.1 }] },
      { t: 1.5, blendshapes: [{ name: 'jawOpen', score: 0.18 }] },
    ]

    expect(fromClipFormat(input)).toEqual([
      { t: 0, categories: [{ categoryName: 'jawOpen', score: 0.02 }, { categoryName: 'mouthSmileLeft', score: 0.1 }] },
      { t: 1500, categories: [{ categoryName: 'jawOpen', score: 0.18 }] },
    ])
  })

  it('preserves a frame with an empty blendshapes array', () => {
    expect(fromClipFormat([{ t: 2, blendshapes: [] }])).toEqual([{ t: 2000, categories: [] }])
  })
})

describe('toClipFormat (internal ms/categoryName shape -> CLIP_FORMAT.md contract)', () => {
  it('returns an empty array for an empty frame list', () => {
    expect(toClipFormat([])).toEqual([])
  })

  it('converts milliseconds to seconds and renames categories/categoryName -> blendshapes/name', () => {
    const input: InternalFrame[] = [
      { t: 0, categories: [{ categoryName: 'eyeBlinkLeft', score: 0.9 }] },
      { t: 2600, categories: [{ categoryName: 'eyeBlinkLeft', score: 0 }, { categoryName: 'eyeBlinkRight', score: 0 }] },
    ]

    expect(toClipFormat(input)).toEqual([
      { t: 0, blendshapes: [{ name: 'eyeBlinkLeft', score: 0.9 }] },
      { t: 2.6, blendshapes: [{ name: 'eyeBlinkLeft', score: 0 }, { name: 'eyeBlinkRight', score: 0 }] },
    ])
  })

  it('preserves a frame with an empty categories array', () => {
    expect(toClipFormat([{ t: 500, categories: [] }])).toEqual([{ t: 0.5, blendshapes: [] }])
  })
})

describe('round-trip', () => {
  it('fromClipFormat -> toClipFormat reproduces the original CLIP_FORMAT frames', () => {
    const original: ClipFormatFrame[] = [
      { t: 0, blendshapes: [{ name: 'jawOpen', score: 0 }, { name: 'mouthSmileLeft', score: 0.05 }] },
      { t: 0.5, blendshapes: [{ name: 'jawOpen', score: 0.02 }, { name: 'mouthSmileLeft', score: 0.06 }] },
      { t: 1.2, blendshapes: [] },
      { t: 3, blendshapes: [{ name: 'eyeBlinkLeft', score: 0.9 }] },
    ]

    expect(toClipFormat(fromClipFormat(original))).toEqual(original)
  })

  it('toClipFormat -> fromClipFormat reproduces the original internal frames', () => {
    const original: InternalFrame[] = [
      { t: 0, categories: [{ categoryName: 'jawOpen', score: 0 }] },
      { t: 1800, categories: [] },
      { t: 3000, categories: [{ categoryName: 'mouthSmileLeft', score: 0.07 }, { categoryName: 'mouthSmileRight', score: 0.07 }] },
    ]

    expect(fromClipFormat(toClipFormat(original))).toEqual(original)
  })

  it('round-trips an entirely empty clip (no frames)', () => {
    expect(toClipFormat(fromClipFormat([]))).toEqual([])
    expect(fromClipFormat(toClipFormat([]))).toEqual([])
  })
})
