import { useEffect, useState } from 'react'

// Matches the 720px breakpoint already used throughout the app's CSS
// (App.css, NavBar.css, Projects.css) so JS-gated mounting decisions line
// up with the same viewport width where the CSS layout itself switches.
const MOBILE_QUERY = '(max-width: 720px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)

    setIsMobile(mediaQueryList.matches)
    mediaQueryList.addEventListener('change', handleChange)

    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}
