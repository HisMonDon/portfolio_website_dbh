
import './LoadingScreen.css';
export default function LoadingScreen() {
    return (
        <div className="loading-screen">
            <video
                className="loading-video"
                src="./assets/loading_portfolio.mp4"
                autoPlay={true}
                playsInline={true}
            />
        </div>
    )
}