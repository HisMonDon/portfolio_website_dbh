import { useState } from 'react'
import './LoadingScreen.css';
// import loadingVideo from './assets/loading_portfolio.mp4'
import backgroundVideo from './assets/backgroung_portfolio.mp4'
import { VolumeOnIcon, HudTriangleMesh } from './features/faceChat/HudIcons'
interface LoadingScreenProps {
    onFinish: () => void
}
export default function LoadingScreen({
    onFinish }: LoadingScreenProps) {
    const [isReady] = useState(true)
    const [isExiting, setIsExiting] = useState(false)

    const handleContinue = () => {
        if (isExiting) return
        setIsExiting(true)
        window.setTimeout(onFinish, 240)
    }

    return (
        <div className="loading-screen">
            {/* <video
                className="loading-video"
                src={loadingVideo}
                autoPlay={true}
                muted
                playsInline={true}
                onEnded={() => setIsReady(true)}
            /> */}
            {isReady && (
                <video
                    className="loading-video loading-bg-video"
                    src={backgroundVideo}
                    autoPlay={true}
                    loop
                    muted
                    playsInline={true}
                />
            )}
            {isReady && (
                <div className={`loading-hud${isExiting ? ' is-exiting' : ''}`}>
                    <div className="loading-grid" aria-hidden="true" />
                    <div className="loading-vignette" aria-hidden="true" />
                    <div className="loading-mask" aria-hidden="true" />

                    <header className="loading-header">
                        <div className="loading-brand">
                            <span>CHENYU_PORTFOLIO_OS</span>
                        </div>
                    </header>

                    <div className="loading-center">
                        <button
                            type="button"
                            className="loading-continue-button"
                            onClick={handleContinue}
                        >
                            <HudTriangleMesh className="loading-continue-mesh" />
                            <span className="loading-continue-mark" aria-hidden="true" />
                            Continue
                        </button>

                        <p className="loading-audio-chip">
                            <VolumeOnIcon className="loading-audio-icon" />
                            Audio recommended for the best experience
                        </p>
                    </div>
                </div>
            )}
            {isExiting && <div className="loading-flash" aria-hidden="true" />}
        </div>
    )
}
