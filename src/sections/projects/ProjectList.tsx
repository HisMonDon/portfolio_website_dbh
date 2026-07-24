import type { WheelEvent } from 'react'
import type { Project } from '../../data/projects'

interface ProjectListProps {
  projects: Project[]
  onSelect: (id: string) => void
}

const PROJECT_SCROLL_SPEED = 0.35

export default function ProjectList({ projects, onSelect }: ProjectListProps) {
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.scrollTop += event.deltaY * PROJECT_SCROLL_SPEED
  }

  return (
    <div className="project-list" onWheel={handleWheel}>
      {projects.map((project) => (
        <button
          type="button"
          key={project.id}
          className="project-panel"
          onClick={() => onSelect(project.id)}
        >
          <span className="project-panel-title">{project.title}</span>
          <span className="project-panel-desc">{project.description}</span>
        </button>
      ))}
    </div>
  )
}
