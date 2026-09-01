import type { Project } from '../../data/projects'

interface ProjectListProps {
  projects: Project[]
  onSelect: (id: string) => void
  variant?: 'featured' | 'more'
}

export default function ProjectList({ projects, onSelect, variant = 'featured' }: ProjectListProps) {
  return (
    <div className={`project-grid project-grid-${variant}`}>
      {projects.map((project) => (
        <button
          type="button"
          key={project.id}
          className="project-card"
          onClick={() => onSelect(project.id)}
        >
          {project.images[0] ? (
            <img className="project-card-image" src={project.images[0]} alt="" />
          ) : (
            <div className="project-card-image project-card-image-empty" aria-hidden="true" />
          )}
          <div className="project-card-body">
            <span className="project-card-title">{project.title}</span>
            <span className="project-card-desc">{project.description}</span>
            {project.technologies.length > 0 && (
              <div className="project-card-tags">
                {project.technologies.slice(0, 4).map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
