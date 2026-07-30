import './LoadingScreen.css';
interface LoadingScreenProps {
    onFinish: () => void
}
export default function LoadingScreen({
    onFinish }: LoadingScreenProps) {
    return (
        <div className="loading-screen">
            <video
                className="loading-video"
                src="./assets/loading_portfolio.mp4"
                autoPlay={true}
                playsInline={true}
                onEnded={onFinish}
            />
        </div>
    )
}