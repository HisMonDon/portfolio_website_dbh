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

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9.6 3.4h4.8l.7 2.2 2 .8 2.1-1.1 3.4 3.4-1.1 2.1.8 2 .3.1-2.5.8-.8 2-2.1 1.1-3.4-3.4 1.1-2.1-.8-2-2.2-.7V3.4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="miter"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function QuestionIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.5 9.2a2.7 2.7 0 0 1 5.2 1c0 2.1-2.7 2.4-2.7 4.2m0 2.7v.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.9"
      />
    </svg>
  )
}
