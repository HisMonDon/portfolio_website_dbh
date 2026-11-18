import { describe, expect, it } from 'vitest'
import {
  createRandom,
  generateFaceRegionMask,
  generatePoreNormalMap,
  generateWeaveNormalMap,
  heightToNormalMap,
  sampleFaceRegions,
} from './skinTextures'

const px = (value: number) => value / 1024

describe('createRandom', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRandom(42)
    const b = createRandom(42)
    const values = Array.from({ length: 100 }, () => a())
    expect(values).toEqual(Array.from({ length: 100 }, () => b()))
    values.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    })
  })
})

describe('heightToNormalMap', () => {
  it('maps a flat height field to the neutral tangent-space normal', () => {
    const data = heightToNormalMap(new Float32Array(16), 4, 2)
    for (let i = 0; i < data.length; i += 4) {
      expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([128, 128, 255, 255])
    }
  })
})

function isTileable(data: Uint8Array, size: number) {
  // Compare the wrap-around seam with an interior seam: a tileable texture has no stronger jump
  // across its edges than between any two neighbouring interior columns.
  const column = (x: number) => Array.from({ length: size }, (_, y) => data[(y * size + x) * 4])
  const jump = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length
  const seam = jump(column(size - 1), column(0))
  const interior = jump(column(size / 2 - 1), column(size / 2))
  return seam < interior * 2.5 + 4
}

describe('procedural detail normals', () => {
  it('produce valid, roughly unit, outward-facing normals that tile', () => {
    const size = 128
    const pores = generatePoreNormalMap(size)
    expect(pores).toHaveLength(size * size * 4)

    let minZ = 255
    for (let i = 0; i < pores.length; i += 4) {
      const x = pores[i] / 127.5 - 1
      const y = pores[i + 1] / 127.5 - 1
      const z = pores[i + 2] / 127.5 - 1
      expect(Math.hypot(x, y, z)).toBeGreaterThan(0.95)
      expect(Math.hypot(x, y, z)).toBeLessThan(1.05)
      minZ = Math.min(minZ, pores[i + 2])
    }
    // Every normal faces outward (z > 0); pore walls are steep but never flip.
    expect(minZ).toBeGreaterThan(140)
    expect(isTileable(pores, size)).toBe(true)

    const weave = generateWeaveNormalMap(64, 16)
    expect(weave).toHaveLength(64 * 64 * 4)
    expect(isTileable(weave, 64)).toBe(true)
  })

  it('is deterministic', () => {
    expect(generatePoreNormalMap(64)).toEqual(generatePoreNormalMap(64))
  })
})

describe('face region mask (Ready Player Me head UV layout)', () => {
  it('marks the T-zone oily and leaves the cheeks dry', () => {
    expect(sampleFaceRegions(px(512), px(225)).oil).toBeGreaterThan(0.8) // forehead
    expect(sampleFaceRegions(px(512), px(425)).oil).toBeGreaterThan(0.9) // nose
    expect(sampleFaceRegions(px(400), px(470)).oil).toBeLessThan(0.1) // cheek
  })

  it('marks the ears as thin and translucent', () => {
    expect(sampleFaceRegions(px(228), px(445)).thin).toBeGreaterThan(0.9)
    expect(sampleFaceRegions(px(795), px(445)).thin).toBeGreaterThan(0.9)
    expect(sampleFaceRegions(px(512), px(225)).thin).toBe(0)
  })

  it('puts the wet line on the lid margin, not inside the eye or on the cheek', () => {
    const rim = sampleFaceRegions(px(420 + 34 * 1.05), px(345)).wet
    const inside = sampleFaceRegions(px(420), px(345)).wet
    const cheek = sampleFaceRegions(px(420), px(430)).wet
    expect(rim).toBeGreaterThan(0.8)
    expect(inside).toBeLessThan(0.1)
    expect(cheek).toBeLessThan(0.05)
  })

  it('marks the lips', () => {
    expect(sampleFaceRegions(px(512), px(530)).lips).toBeGreaterThan(0.9)
  })

  it('packs oil/thin/wet/lips into RGBA', () => {
    const size = 64
    const data = generateFaceRegionMask(size)
    const x = Math.floor((228 / 1024) * size)
    const y = Math.floor((445 / 1024) * size)
    expect(data[(y * size + x) * 4 + 1]).toBeGreaterThan(200)
  })
})
