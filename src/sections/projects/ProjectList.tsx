import type { Project } from '../../data/projects'

interface ProjectListProps {
  projects: Project[]
  onSelect: (id: string) => void
}

export default function ProjectList({ projects, onSelect }: ProjectListProps) {
  return (
    <div className="project-list">
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
