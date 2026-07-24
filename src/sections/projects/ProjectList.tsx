import { useEffect, useRef } from 'react'
import type { Project } from '../../data/projects'

interface ProjectListProps {
  projects: Project[]
  onSelect: (id: string) => void
  onPreview: (project: Project | null) => void
}

const PROJECT_SCROLL_SPEED = 0.12

export default function ProjectList({ projects, onSelect, onPreview }: ProjectListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listRef.current

    if (!list) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      list.scrollTop += event.deltaY * PROJECT_SCROLL_SPEED
    }

    list.addEventListener('wheel', handleWheel, { passive: false })

    return () => list.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div className="project-list" ref={listRef}>
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
