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
    <div>
      <h1 className="section-title">My Projects</h1>
      <p className="section-text">Here are a few things I&apos;ve been working on.</p>
      <aside
        className={`project-preview${previewProject ? ' is-visible' : ''}`}
        aria-live="polite"
      >
        {previewProject && (
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
