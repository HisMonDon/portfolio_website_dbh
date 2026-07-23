import { useState } from 'react'
import ProjectList from './ProjectList'
import ProjectDetail from './ProjectDetail'
import { PROJECTS } from '../../data/projects'
import '../Section.css'
import './Projects.css'

export default function Projects() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = PROJECTS.find((project) => project.id === selectedId) ?? null

  if (selected) {
    return <ProjectDetail project={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <div>
      <p className="section-eyebrow">Work</p>
      <h1 className="section-title">Projects</h1>
      <ProjectList projects={PROJECTS} onSelect={setSelectedId} />
    </div>
  )
}
