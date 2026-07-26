import { lazy, Suspense, useState } from 'react'
import type { Project } from '../../data/projects'

const FaceChatWidget = lazy(() => import('../../features/faceChat/FaceChatWidget'))

interface ProjectDetailProps {
  project: Project
  onBack: () => void
}

export default function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [imgIndex, setImgIndex] = useState(0)

  const prev = () =>
    setImgIndex((i) => (i - 1 + project.images.length) % project.images.length)
  const next = () => setImgIndex((i) => (i + 1) % project.images.length)

  return (
    <div>
      <button type="button" className="project-detail-header" onClick={onBack}>
        <span aria-hidden="true">&larr;</span> Projects
      </button>

      {project.interactive ? (
        <>
          <Suspense fallback={null}>
            <FaceChatWidget />
          </Suspense>
          <p className="section-text">
            <strong>How it works:</strong> MediaPipe's FaceLandmarker runs in the browser and scores
            a fixed set of named facial blendshapes (e.g. <code>jawOpen</code>,{' '}
            <code>mouthSmileLeft</code>) from the webcam feed every frame. Those scores are
            calibrated against a short rest-pose baseline, then applied by name to the matching
            morph target on a Three.js avatar mesh — no keyframes, just per-frame influence
            values driving the mesh's existing morph targets. Dialogue answers reuse the same
            pipeline in reverse: prerecorded blendshape frames (captured the same way, saved as
            timestamped JSON) get walked back on a clock and applied the same way, so the avatar
            "speaks" pre-recorded answers through the identical rendering path as live tracking.
          </p>
        </>
      ) : (
        <>
          <div className="project-carousel">
            <button
              type="button"
              className="project-carousel-arrow"
              onClick={prev}
              aria-label="Previous image"
            >
              &lsaquo;
            </button>
            <div className="project-carousel-frame">
              <img
                src={project.images[imgIndex]}
                alt={`${project.title} screenshot ${imgIndex + 1}`}
              />
            </div>
            <button
              type="button"
              className="project-carousel-arrow"
              onClick={next}
              aria-label="Next image"
            >
              &rsaquo;
            </button>
          </div>

          <div className="project-carousel-dots">
            {project.images.map((image, i) => (
              <button
                type="button"
                key={image}
                className={`project-carousel-dot${i === imgIndex ? ' active' : ''}`}
                onClick={() => setImgIndex(i)}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <h1 className="section-title">{project.title}</h1>
      <p className="section-text">{project.description}</p>
      {project.technologies.length > 0 && (
        <div className="project-technologies">
          {project.technologies.map((technology) => (
            <span key={technology}>{technology}</span>
          ))}
        </div>
      )}
      {(project.githubUrl || project.liveUrl) && (
        <div className="project-links">
          {project.githubUrl && (
            <a href={project.githubUrl} target="_blank" rel="noreferrer">
              View on GitHub
            </a>
          )}
          {project.liveUrl && (
            <a href={project.liveUrl} target="_blank" rel="noreferrer">
              View Live Demo
            </a>
          )}
        </div>
      )}
    </div>
  )
}
