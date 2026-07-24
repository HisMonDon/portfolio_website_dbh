import { useState, useEffect, useRef } from 'react'
import NavBar, { type SectionId } from './components/NavBar'
import AvatarSlot from './components/AvatarSlot'
import AboutMe from './sections/AboutMe'
import Resume from './sections/Resume'
import Skills from './sections/Skills'
import Credits from './sections/Credits'
import Projects from './sections/projects/Projects'
import './App.css'

type ActiveSection = {
  first: SectionId;
  second: SectionId;
  third: SectionId;
};
function renderSection(active: ActiveSection["first"]) {
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
  const secondSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>({
    first: 'credits',
    second: 'about',
    third: 'resume',
  });
  useEffect(() => {
    secondSectionRef.current?.scrollIntoView();
  }, []);

  return (
    <div className="app">
      <div className="scroll-stage">
        <div className="section-page">{renderSection(activeSection.first)}</div>

        <div ref={secondSectionRef} className="section-page">
          {renderSection(activeSection.second)}
        </div>

        <div className="section-page">{renderSection(activeSection.third)}</div>
      </div>

      <AvatarSlot />

      <NavBar active={activeSection.second} onSelect={() => { }} />
    </div>
  );
}

export default App
