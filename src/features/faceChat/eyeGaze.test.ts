import { describe, expect, it } from 'vitest'
import {
  computeEyeGaze,
  EYE_MAX_PITCH_DOWN,
  EYE_MAX_PITCH_UP,
  EYE_MAX_YAW,
  NEUTRAL_EYE_GAZE,
  smoothEyeGaze,
} from './eyeGaze'

const scores = (values: Record<string, number>) =>
  Object.entries(values).map(([categoryName, score]) => ({ categoryName, score }))

describe('computeEyeGaze', () => {
  it('is neutral without eye-look scores', () => {
    expect(computeEyeGaze(scores({ jawOpen: 0.5 }))).toEqual(NEUTRAL_EYE_GAZE)
  })

  it('turns both eyes toward the avatar\'s left for left-out / right-in', () => {
    const gaze = computeEyeGaze(scores({ eyeLookOutLeft: 1, eyeLookInRight: 1 }))
    expect(gaze.left.yaw).toBeCloseTo(EYE_MAX_YAW)
    expect(gaze.right.yaw).toBeCloseTo(EYE_MAX_YAW)
  })

  it('turns both eyes toward the avatar\'s right for left-in / right-out', () => {
    const gaze = computeEyeGaze(scores({ eyeLookInLeft: 1, eyeLookOutRight: 1 }))
    expect(gaze.left.yaw).toBeCloseTo(-EYE_MAX_YAW)
    expect(gaze.right.yaw).toBeCloseTo(-EYE_MAX_YAW)
  })

  it('maps up/down to pitch and keeps both eyes at the same height', () => {
    const up = computeEyeGaze(scores({ eyeLookUpLeft: 1, eyeLookUpRight: 0.5 }))
    expect(up.left.pitch).toBeCloseTo(EYE_MAX_PITCH_UP * 0.75)
    expect(up.right.pitch).toBe(up.left.pitch)

    const down = computeEyeGaze(scores({ eyeLookDownLeft: 1, eyeLookDownRight: 1 }))
    expect(down.left.pitch).toBeCloseTo(-EYE_MAX_PITCH_DOWN)
  })

  it('clamps exaggerated calibrated scores', () => {
    const gaze = computeEyeGaze(scores({ eyeLookOutLeft: 2.4, eyeLookInLeft: -1 }))
    expect(gaze.left.yaw).toBeCloseTo(EYE_MAX_YAW)
  })
})

describe('smoothEyeGaze', () => {
  it('moves halfway toward the target after one half-life and is frame-rate independent', () => {
    const target = computeEyeGaze(scores({ eyeLookOutLeft: 1, eyeLookInRight: 1 }))
    const half = smoothEyeGaze(NEUTRAL_EYE_GAZE, target, 45, 45)
    expect(half.left.yaw).toBeCloseTo(target.left.yaw / 2)

    let stepped = NEUTRAL_EYE_GAZE
    for (let i = 0; i < 3; i += 1) stepped = smoothEyeGaze(stepped, target, 15, 45)
    expect(stepped.left.yaw).toBeCloseTo(half.left.yaw)
  })
})
