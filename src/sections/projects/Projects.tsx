import { useState } from 'react'
import ProjectList from './ProjectList'
import ProjectDetail from './ProjectDetail'
import { PROJECTS, type Project } from '../../data/projects'
import '../Section.css'
import './Projects.css'

interface ProjectsProps {
  // Lifted to App so it can drive the persistent assistant's fade behavior
  // ("fade back in when they click into a specific project tab").
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export default function Projects({ selectedId, onSelect }: ProjectsProps) {
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const selected = PROJECTS.find((project) => project.id === selectedId) ?? null

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => onSelect(null)} />
  }

  return (
    <div className="projects-overview">
      <h1 className="section-title">My Projects</h1>
      <p className="section-text">Here are a few things I&apos;ve been working on.</p>
      <aside
        className={`project-preview is-visible${previewProject ? ' has-project' : ' is-empty'}`}
        aria-live="polite"
      >
        {previewProject ? (
          <>
            {previewProject.images[0] && (
              <img
                className="project-preview-image"
                src={previewProject.images[0]}
                alt={`${previewProject.title} preview`}
              />
            )}
            <div className="project-preview-content">
              <p className="project-preview-eyebrow">Project preview</p>
              <h2 className="project-preview-title">{previewProject.title}</h2>
              <p className="project-preview-description">{previewProject.description}</p>
            </div>
          </>
        ) : (
          <div className="project-preview-empty">
            <div className="project-preview-empty-visual" aria-hidden="true">
              <span className="project-preview-empty-card project-preview-empty-card-back" />
              <span className="project-preview-empty-card project-preview-empty-card-front">
                <span />
                <span />
                <span />
              </span>
              <span className="project-preview-empty-pointer" />
            </div>

            <p className="project-preview-eyebrow">Project explorer</p>
            <h2 className="project-preview-empty-title">Take a closer look</h2>
            <p className="project-preview-empty-description">
              Hover over a project to see more about it, or click it for a detailed explanation.
            </p>

            <div className="project-preview-empty-actions" aria-hidden="true">
              <span><strong>Hover</strong> Quick preview</span>
              <span><strong>Click</strong> Full explanation</span>
            </div>
          </div>
        )}
      </aside>
      <ProjectList
        projects={PROJECTS}
        onSelect={onSelect}
        onPreview={setPreviewProject}
      />
    </div>
  )
}
