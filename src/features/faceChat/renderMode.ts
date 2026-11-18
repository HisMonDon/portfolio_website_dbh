// `?render=legacy` keeps the original glossy/plastic look (one hemisphere + three directional
// lights, ACES at 1.35, clearcoat skin) so the realistic pipeline can be compared against it.
export type AvatarRenderMode = 'realistic' | 'legacy'

export function resolveRenderMode(search: string | null | undefined): AvatarRenderMode {
  if (!search) return 'realistic'

  try {
    const value = new URLSearchParams(search).get('render')
    return value?.trim().toLowerCase() === 'legacy' ? 'legacy' : 'realistic'
  } catch {
    return 'realistic'
  }
}

export function currentRenderMode(): AvatarRenderMode {
  if (typeof window === 'undefined') return 'realistic'
  return resolveRenderMode(window.location.search)
}
