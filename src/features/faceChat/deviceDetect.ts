// Basic, intentionally non-exhaustive mobile detection: viewport width or
// user agent hints. Good enough to steer mobile visitors to the fallback
// UI instead of prompting for camera access on a device where a webcam
// face-tracking demo isn't a good experience.
export function isLikelyMobile(): boolean {
  if (typeof window === 'undefined') return false

  const narrowViewport = window.innerWidth <= 768
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  return narrowViewport || mobileUserAgent
}
