import { useEffect, useRef } from 'react'
import ProjectList from './ProjectList'
import ProjectDetail from './ProjectDetail'
import Honors from './Honors'
import { PROJECTS } from '../../data/projects'
import '../Section.css'
import './Projects.css'

interface ProjectsProps {
  selectedId: string | null
  onSelect: (id: string | null) => void
  isActive: boolean
}

export default function Projects({ selectedId, onSelect, isActive }: ProjectsProps) {
  const overviewRef = useRef<HTMLDivElement | null>(null)
  const selected = PROJECTS.find((project) => project.id === selectedId) ?? null

  // The section stays mounted across nav switches, so its scroll position
  // otherwise survives a trip away and back, landing mid-scroll on return.
  useEffect(() => {
    if (isActive) {
      overviewRef.current?.scrollTo({ top: 0 })
    }
  }, [isActive])

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => onSelect(null)} />
  }

  const featured = PROJECTS.filter((project) => project.tier === 'featured')
  const more = PROJECTS.filter((project) => project.tier === 'more')

  return (
    <div className="projects-overview" ref={overviewRef}>
      <h1 className="section-title">My Projects</h1>
      <p className="section-text">Here are a few things I&apos;ve been working on.</p>

      <h2 className="projects-group-title">Featured Projects</h2>
      <ProjectList projects={featured} onSelect={onSelect} variant="featured" />

      {more.length > 0 && (
        <>
          <h2 className="projects-group-title">More Projects</h2>
          <ProjectList projects={more} onSelect={onSelect} variant="more" />
        </>
      )}

      <Honors />
    </div>
  )
}
