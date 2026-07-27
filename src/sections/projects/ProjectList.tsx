import type { Project } from '../../data/projects'

interface ProjectListProps {
  projects: Project[]
  onSelect: (id: string) => void
  onPreview: (project: Project | null) => void
}

export default function ProjectList({ projects, onSelect, onPreview }: ProjectListProps) {
  return (
    <div className="project-list">
      {projects.map((project) => (
        <button
          type="button"
          key={project.id}
          className="project-panel"
          onClick={() => onSelect(project.id)}
          onMouseEnter={() => onPreview(project)}
          onMouseLeave={() => onPreview(null)}
          onFocus={() => onPreview(project)}
          onBlur={() => onPreview(null)}
        >
          <span className="project-panel-title">{project.title}</span>
          <span className="project-panel-desc">{project.description}</span>
        </button>
      ))}
    </div>
  )
}
