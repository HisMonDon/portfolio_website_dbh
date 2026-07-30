import './LoadingScreen.css';
import loadingVideo from './assets/loading_portfolio.mp4'
interface LoadingScreenProps {
    onFinish: () => void
}
export default function LoadingScreen({
    onFinish }: LoadingScreenProps) {
    return (
        <div className="loading-screen">
            <video
                className="loading-video"
                src={loadingVideo}
                autoPlay={true}
                muted
                playsInline={true}
                onEnded={onFinish}
            />
        </div>
    )
}