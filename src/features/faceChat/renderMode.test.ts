import { describe, expect, it } from 'vitest'
import { resolveRenderMode } from './renderMode'

describe('resolveRenderMode', () => {
  it('defaults to the realistic pipeline', () => {
    expect(resolveRenderMode('')).toBe('realistic')
    expect(resolveRenderMode(null)).toBe('realistic')
    expect(resolveRenderMode('?quality=high')).toBe('realistic')
  })

  it('switches to the legacy look with ?render=legacy (case-insensitive)', () => {
    expect(resolveRenderMode('?render=legacy')).toBe('legacy')
    expect(resolveRenderMode('?quality=low&render=LEGACY')).toBe('legacy')
  })

  it('ignores unknown render values', () => {
    expect(resolveRenderMode('?render=fancy')).toBe('realistic')
  })
})
