import { useState } from 'react'
import type { Project } from '../../data/projects'

interface ProjectDetailProps {
  project: Project
  onBack: () => void
}

export default function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const [imgIndex, setImgIndex] = useState(0)
  const hasMultipleImages = project.images.length > 1

  const prev = () => {
    if (!hasMultipleImages) return
    setImgIndex((index) => (index - 1 + project.images.length) % project.images.length)
  }

  const next = () => {
    if (!hasMultipleImages) return
    setImgIndex((index) => (index + 1) % project.images.length)
  }

  return (
    <div className="project-detail">
      <button type="button" className="project-detail-header" onClick={onBack}>
        <span aria-hidden="true">&larr;</span> Projects
      </button>

      <div className={`project-detail-layout${project.story?.length ? ' has-story' : ''}`}>
        <div className="project-detail-left">
          <section className="project-detail-summary">
            <h1>{project.title}</h1>
            <p className="project-detail-lead">{project.description}</p>

            {project.technologies.length > 0 && (
              <div className="project-technologies" aria-label="Technologies used">
                {project.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            )}

            {(project.githubUrl || project.liveUrl) && (
              <div className="project-links">
                {project.githubUrl && (
                  <a href={project.githubUrl} target="_blank" rel="noreferrer">
                    View on GitHub <span aria-hidden="true">↗</span>
                  </a>
                )}
                {project.liveUrl && (
                  <a href={project.liveUrl} target="_blank" rel="noreferrer">
                    {project.liveLabel ?? 'View Live Demo'} <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            )}
          </section>

          <section className="project-detail-visual" aria-label={`${project.title} media`}>
            {project.images.length > 0 ? (
              <>
                <div className="project-carousel">
                  {hasMultipleImages && (
                    <button
                      type="button"
                      className="project-carousel-arrow"
                      onClick={prev}
                      aria-label="Previous image"
                    >
                      &lsaquo;
                    </button>
                  )}
                  <div className="project-carousel-frame">
                    <img
                      key={project.images[imgIndex]}
                      src={project.images[imgIndex]}
                      alt={`${project.title} screenshot ${imgIndex + 1}`}
                    />
                  </div>
                  {hasMultipleImages && (
                    <button
                      type="button"
                      className="project-carousel-arrow"
                      onClick={next}
                      aria-label="Next image"
                    >
                      &rsaquo;
                    </button>
                  )}
                </div>

                {hasMultipleImages && (
                  <div className="project-carousel-dots">
                    {project.images.map((image, index) => (
                      <button
                        type="button"
                        key={image}
                        className={`project-carousel-dot${index === imgIndex ? ' active' : ''}`}
                        onClick={() => setImgIndex(index)}
                        aria-label={`Go to image ${index + 1}`}
                      />
                    ))}
                  </div>
                )}

                <p className="project-media-caption">
                  <span>{String(imgIndex + 1).padStart(2, '0')}</span>
                  {project.title} project gallery
                </p>
              </>
            ) : (
              <div className="project-system-visual">
                <p>Interactive system</p>
                <h2>Performance pipeline</h2>
                <div className="project-system-flow" aria-hidden="true">
                  <span>Capture</span>
                  <i />
                  <span>Calibrate</span>
                  <i />
                  <span>Replay</span>
                </div>
                <small>MediaPipe data translated into a rendered Three.js performance.</small>
              </div>
            )}
          </section>
        </div>

        {project.story && project.story.length > 0 && (
          <article className="project-detail-content">
            <header className="project-story-header">
              <p className="project-detail-eyebrow">Behind the build</p>
              <h2>From problem to outcome</h2>
            </header>
            <div className="project-story">
              {project.story.map((section, index) => (
                <section className="project-story-section" key={section.title}>
                  <span className="project-story-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2>{section.title}</h2>
                    <p>{section.body}</p>
                  </div>
                </section>
              ))}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}
