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
            {project.resultBadge && (
              <p className="project-result-badge">{project.resultBadge}</p>
            )}
            <p className="project-detail-lead">{project.description}</p>

            {project.technologies.length > 0 && (
              <div className="project-technologies" aria-label="Technologies used">
                {project.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            )}

            {(project.githubUrl || project.liveUrl || project.deepDive?.length) && (
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
                {project.deepDive && project.deepDive.length > 0 && (
                  <button
                    type="button"
                    className="project-deep-dive-link"
                    onClick={() => {
                      document
                        .getElementById(`deep-dive-${project.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    Technical Deep Dive <span aria-hidden="true">↓</span>
                  </button>
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

        {(project.story?.length || project.challenges?.length || project.deepDive?.length) ? (
          <article className="project-detail-content">
            {project.story && project.story.length > 0 && (
              <>
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
              </>
            )}

            {project.challenges && project.challenges.length > 0 && (
              <section className="project-challenges">
                <header className="project-story-header">
                  <p className="project-detail-eyebrow">Technical challenges</p>
                  <h2>Problems and how they were solved</h2>
                </header>
                <ul className="project-challenges-list">
                  {project.challenges.map((challenge) => (
                    <li className="project-challenge" key={challenge.problem}>
                      <p className="project-challenge-problem">{challenge.problem}</p>
                      <p className="project-challenge-approach">{challenge.approach}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {project.architecture && (
              <section className="project-architecture-section">
                <header className="project-story-header">
                  <p className="project-detail-eyebrow">Architecture</p>
                  <h2>How data moves through the system</h2>
                </header>
                <pre className="project-architecture">{project.architecture}</pre>
              </section>
            )}

            {project.deepDive && project.deepDive.length > 0 && (
              <section className="project-deep-dive" id={`deep-dive-${project.id}`}>
                <header className="project-story-header">
                  <p className="project-detail-eyebrow">Technical deep dive</p>
                  <h2>Past the demo</h2>
                </header>
                <div className="project-deep-dive-list">
                  {project.deepDive.map((entry) => (
                    <div className="project-deep-dive-entry" key={entry.question}>
                      <h3>{entry.question}</h3>
                      <p>{entry.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : null}
      </div>
    </div>
  )
}
