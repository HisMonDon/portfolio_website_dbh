import { useState } from 'react'
import NavBar, { type SectionId } from './components/NavBar'
import AvatarSlot from './components/AvatarSlot'
import AboutMe from './sections/AboutMe'
import Resume from './sections/Resume'
import Skills from './sections/Skills'
import Credits from './sections/Credits'
import Projects from './sections/projects/Projects'
import './App.css'

function renderSection(active: SectionId) {
  switch (active) {
    case 'about':
      return <AboutMe />
    case 'resume':
      return <Resume />
    case 'projects':
      return <Projects />
    case 'skills':
      return <Skills />
    case 'credits':
      return <Credits />
    default:
      return null
  }
}

function App() {
  const [active, setActive] = useState<SectionId>('about')

  return (
    <div className="app">
      <div className="app-stage">
        <div className="app-panel">{renderSection(active)}</div>
        <AvatarSlot />
      </div>
      <NavBar active={active} onSelect={setActive} />
    </div>
  )
}

export default App
