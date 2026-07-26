import { useState } from 'react'
import ProjectList from './ProjectList'
import ProjectDetail from './ProjectDetail'
import { PROJECTS, type Project } from '../../data/projects'
import '../Section.css'
import './Projects.css'

export default function Projects() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewProject, setPreviewProject] = useState<Project | null>(null)
  const selected = PROJECTS.find((project) => project.id === selectedId) ?? null

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => setSelectedId(null)} />
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
        onSelect={setSelectedId}
        onPreview={setPreviewProject}
      />
    </div>
  )
}
