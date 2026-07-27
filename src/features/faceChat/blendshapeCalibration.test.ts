import { describe, expect, it } from 'vitest'
import {
  buildCalibrationBaseline,
  createBlendshapeCalibrator,
} from './blendshapeCalibration'
import type { ClipFormatFrame } from './clipFormat'

describe('buildCalibrationBaseline', () => {
  it('averages the requested neutral samples by blendshape name', () => {
    const frames: ClipFormatFrame[] = [
      {
        t: 0,
        blendshapes: [
          { name: 'jawOpen', score: 0.1 },
          { name: 'eyeBlinkLeft', score: 0.2 },
        ],
      },
      {
        t: 0.05,
        blendshapes: [
          { name: 'jawOpen', score: 0.3 },
          { name: 'eyeBlinkLeft', score: 0.4 },
        ],
      },
    ]

    expect(buildCalibrationBaseline(frames, 2)).toEqual({
      jawOpen: 0.2,
      eyeBlinkLeft: 0.30000000000000004,
    })
  })

  it('returns an empty baseline when there are no calibration frames', () => {
    expect(buildCalibrationBaseline([])).toEqual({})
  })
})

describe('createBlendshapeCalibrator', () => {
  it('subtracts the neutral baseline and applies non-blink smoothing', () => {
    const calibrator = createBlendshapeCalibrator({ jawOpen: 0.2 })

    // ((0.6 - 0.2) / (1 - 0.2)) * 0.4 smoothing = 0.2
    expect(calibrator.apply([{ categoryName: 'jawOpen', score: 0.6 }])).toEqual([
      { categoryName: 'jawOpen', score: 0.19999999999999998 },
    ])

    // The next sample smooths from the previous calibrated value.
    expect(calibrator.apply([{ categoryName: 'jawOpen', score: 1 }])[0].score).toBeCloseTo(0.52)
  })

  it('uses the recording harness blink curve without mouth smoothing', () => {
    const calibrator = createBlendshapeCalibrator({ eyeBlinkLeft: 0 })

    expect(calibrator.apply([{ categoryName: 'eyeBlinkLeft', score: 0.5 }])[0].score).toBeCloseTo(
      Math.pow(0.5, 2.2),
    )
  })

  it('applies the source exaggeration map and clamps the final score', () => {
    const calibrator = createBlendshapeCalibrator({ mouthSmileLeft: 0 })

    // 1 * 2.4 exaggeration * 0.4 smoothing = 0.96 on the first sample.
    expect(calibrator.apply([{ categoryName: 'mouthSmileLeft', score: 1 }])[0].score).toBeCloseTo(
      0.96,
    )
    expect(calibrator.apply([{ categoryName: 'mouthSmileLeft', score: 1 }])[0].score).toBe(1)
  })
})
