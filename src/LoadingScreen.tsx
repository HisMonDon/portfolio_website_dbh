import { useState } from 'react'
import './LoadingScreen.css';
import loadingVideo from './assets/loading_portfolio.mp4'
interface LoadingScreenProps {
    onFinish: () => void
}
export default function LoadingScreen({
    onFinish }: LoadingScreenProps) {
    const [isReady, setIsReady] = useState(false)

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
                <button
                    type="button"
                    className="loading-continue-button"
                    onClick={onFinish}
                >
                    Continue
                </button>
            )}
        </div>
    )
}