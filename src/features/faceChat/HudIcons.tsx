interface IconProps {
  className?: string
}

export type ChoiceMarkerKind = 'triangle' | 'square' | 'circle' | 'cross' | 'back'

export function ChoiceMarkerIcon({
  kind,
  className,
}: IconProps & { kind: ChoiceMarkerKind }) {
  const sharedProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    strokeWidth: 2.25,
    vectorEffect: 'non-scaling-stroke' as const,
  }

  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      {kind === 'triangle' && <path d="M10 2.5 17.2 16H2.8L10 2.5Z" {...sharedProps} />}
      {kind === 'square' && <rect x="3.5" y="3.5" width="13" height="13" {...sharedProps} />}
      {kind === 'circle' && <circle cx="10" cy="10" r="7" {...sharedProps} />}
      {kind === 'cross' && (
        <path d="m3.8 3.8 12.4 12.4m0-12.4L3.8 16.2" {...sharedProps} />
      )}
      {kind === 'back' && <path d="M17 10H3m0 0 5.2-5.2M3 10l5.2 5.2" {...sharedProps} />}
    </svg>
  )
}

export function VolumeOnIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" strokeLinejoin="miter" strokeWidth="2" />
      <path d="M16 8.4a5 5 0 0 1 0 7.2M18.6 5.8a8.5 8.5 0 0 1 0 12.4" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="2" />
    </svg>
  )
}

export function VolumeOffIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="none" stroke="currentColor" strokeLinejoin="miter" strokeWidth="2" />
      <path d="m16.2 9.2 5.2 5.2m0-5.2-5.2 5.2" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth="2" />
    </svg>
  )
}
