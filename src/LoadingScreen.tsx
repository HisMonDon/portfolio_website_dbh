import { useState } from 'react'
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

    const handleContinue = () => {
        if (isExiting) return
        setIsExiting(true)
        window.setTimeout(onFinish, 240)
    }

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
                    <div className="loading-grid" aria-hidden="true" />
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
                        <div className="loading-mark" aria-hidden="true">
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
