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
      <h1 className="section-title">My Projects</h1>
      <p className="section-text">Here are a few things I&apos;ve been working on.</p>
      <ProjectList projects={PROJECTS} onSelect={setSelectedId} />
    </div>
  )
}
