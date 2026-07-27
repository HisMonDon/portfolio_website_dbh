interface IconProps {
  className?: string
}

export type ChoiceMarkerKind = 'triangle' | 'square' | 'circle' | 'cross' | 'back'

const HUD_TRIANGLE_POINTS = [
  '0,0 100,100 0,100',
  '0,0 200,0 100,100',
  '100,100 300,100 200,0',
  '200,0 400,0 300,100',
  '300,100 500,100 400,0',
  '400,0 600,0 500,100',
  '500,100 700,100 600,0',
  '600,0 700,0 700,100',
] as const

export function HudTriangleMesh({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 700 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {HUD_TRIANGLE_POINTS.map((points, index) => (
        <polygon
          key={points}
          className={`hud-triangle-mesh-piece is-${index + 1}`}
          points={points}
        />
      ))}
    </svg>
  )
}

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
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
