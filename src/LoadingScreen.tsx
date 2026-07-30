import { useEffect, useRef, useState } from 'react'
import './LoadingScreen.css';
import loadingVideo from './assets/loading_portfolio.mp4'
import { VolumeOnIcon } from './features/faceChat/HudIcons'
interface LoadingScreenProps {
    onFinish: () => void
}
export default function LoadingScreen({
    onFinish }: LoadingScreenProps) {
    const [isReady, setIsReady] = useState(false)
    const [isExiting, setIsExiting] = useState(false)
    const gridRef = useRef<HTMLDivElement | null>(null)
    const markRef = useRef<HTMLDivElement | null>(null)

    const handleContinue = () => {
        if (isExiting) return
        setIsExiting(true)
        window.setTimeout(onFinish, 240)
    }

    // CSS transitions don't reliably pick up calc(var(--custom-prop)) changes unless the
    // property is registered via @property, so the parallax offset is applied directly to each
    // element's transform instead of routed through a CSS variable.
    useEffect(() => {
        if (!isReady) return

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) return

        const handlePointerMove = (event: PointerEvent) => {
            const px = (event.clientX / window.innerWidth) * 2 - 1
            const py = (event.clientY / window.innerHeight) * 2 - 1

            if (gridRef.current) {
                gridRef.current.style.transform = `translate3d(${(px * 12).toFixed(2)}px, ${(py * 12).toFixed(2)}px, 0)`
            }
            if (markRef.current) {
                markRef.current.style.transform = `translate3d(${(px * -16).toFixed(2)}px, ${(py * -16).toFixed(2)}px, 0)`
            }
        }

        window.addEventListener('pointermove', handlePointerMove)
        return () => window.removeEventListener('pointermove', handlePointerMove)
    }, [isReady])

    return (
        <div className="loading-screen">
            <video
                className="loading-video"
                src={loadingVideo}
                autoPlay={true}
                muted
                playsInline={true}
                onEnded={() => setIsReady(true)}
            />
            {isReady && (
                <div className={`loading-hud${isExiting ? ' is-exiting' : ''}`}>
                    <div ref={gridRef} className="loading-grid" aria-hidden="true" />
                    <div className="loading-vignette" aria-hidden="true" />
                    <div className="loading-scanline" aria-hidden="true" />

                    <header className="loading-header">
                        <div className="loading-brand">
                            <span>CHENYU_PORTFOLIO_OS</span>
                            <span className="loading-brand-rule" aria-hidden="true" />
                        </div>
                        <div className="loading-status-tag">
                            <span className="loading-status-dot" aria-hidden="true" />
                            SIGNAL STABLE
                        </div>
                    </header>

                    <div className="loading-center">
                        <div ref={markRef} className="loading-mark" aria-hidden="true">
                            <span className="loading-mark-square is-a" />
                            <span className="loading-mark-square is-b" />
                        </div>

                        <button
                            type="button"
                            className="loading-continue-button"
                            onClick={handleContinue}
                        >
                            <span className="loading-continue-bracket is-tl" aria-hidden="true" />
                            <span className="loading-continue-bracket is-br" aria-hidden="true" />
                            <span className="loading-continue-mark" aria-hidden="true" />
                            Continue
                        </button>

                        <div className="loading-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>

                    <p className="loading-audio-chip">
                        <span className="loading-chip-bracket is-tl" aria-hidden="true" />
                        <span className="loading-chip-bracket is-br" aria-hidden="true" />
                        <VolumeOnIcon className="loading-audio-icon" />
                        Audio recommended for the best experience
                    </p>
                </div>
            )}
            {isExiting && <div className="loading-flash" aria-hidden="true" />}
        </div>
    )
}
