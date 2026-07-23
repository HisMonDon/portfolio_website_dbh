import { useState } from 'react'
import type { Project } from '../../data/projects'

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
          Image {imgIndex + 1} / {project.images.length}
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

      <h1 className="section-title">{project.title}</h1>
      <p className="section-text">{project.description}</p>
    </div>
  )
}
