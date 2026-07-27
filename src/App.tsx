import { useState, useEffect, useRef } from 'react'
import NavBar, { type SectionId } from './components/NavBar'
import PersistentAssistant from './components/PersistentAssistant'
import Resume from './sections/Resume'
import Skills from './sections/Skills'
import Credits from './sections/Credits'
import Projects from './sections/projects/Projects'
import './App.css'
import backgroundVideo from './assets/backgroung_portfolio.mp4'
import { SECTION_ORDER } from './sections/sectionConfig'
import { useIsMobile } from './hooks/useIsMobile'

const INITIAL_SECTION: SectionId = 'about'
const NAV_SCROLL_DURATION_MS = 900

function renderSection(
  active: SectionId,
  selectedProjectId: string | null,
  onSelectProject: (id: string | null) => void,
) {
  switch (active) {
    case 'about':
      return null
    case 'resume':
      return <Resume />
    case 'projects':
      return <Projects selectedId={selectedProjectId} onSelect={onSelectProject} />
    case 'skills':
      return <Skills />
    case 'credits':
      return <Credits />
    default:
      return null
  }
}

function App() {
  const scrollStageRef = useRef<HTMLDivElement | null>(null)
  const navScrollFrameRef = useRef<number | null>(null)
  const isProgrammaticScrollRef = useRef(false)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    about: null,
    resume: null,
    projects: null,
    skills: null,
    credits: null,
  })
  const [activeSection, setActiveSection] = useState<SectionId>(INITIAL_SECTION)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const isMobile = useIsMobile()
  const isAssistantVisible = activeSection !== 'projects' || selectedProjectId !== null

  useEffect(() => {
    const scrollStage = scrollStageRef.current
    const initialSection = sectionRefs.current[INITIAL_SECTION]

    if (scrollStage && initialSection) {
      scrollStage.scrollTop = initialSection.offsetTop
    }
  }, [])

  useEffect(() => {
    const scrollStage = scrollStageRef.current

    if (!scrollStage) return

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (!mostVisible) return

        const id = mostVisible.target.getAttribute('data-section') as SectionId | null

        if (isProgrammaticScrollRef.current) return

        if (id) {
          setActiveSection((current) => current === id ? current : id)
        }
      },
      {
        root: scrollStage,
        threshold: [0.55, 0.7, 0.85],
      },
    )

    Object.values(sectionRefs.current).forEach((section) => {
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const scrollStage = scrollStageRef.current

    const cancelProgrammaticScroll = () => {
      if (navScrollFrameRef.current !== null) {
        cancelAnimationFrame(navScrollFrameRef.current)
        navScrollFrameRef.current = null
      }

      isProgrammaticScrollRef.current = false
    }

    // A real gesture always wins over an in-progress navbar animation. Otherwise the animation
    // and the browser can alternately write scrollTop and create another apparent jump.
    scrollStage?.addEventListener('wheel', cancelProgrammaticScroll, { passive: true })
    scrollStage?.addEventListener('touchstart', cancelProgrammaticScroll, { passive: true })
    scrollStage?.addEventListener('pointerdown', cancelProgrammaticScroll, { passive: true })

    return () => {
      scrollStage?.removeEventListener('wheel', cancelProgrammaticScroll)
      scrollStage?.removeEventListener('touchstart', cancelProgrammaticScroll)
      scrollStage?.removeEventListener('pointerdown', cancelProgrammaticScroll)
      cancelProgrammaticScroll()
    }
  }, [])

  const scrollToSection = (id: SectionId) => {
    const scrollStage = scrollStageRef.current
    const targetSection = sectionRefs.current[id]

    if (!scrollStage || !targetSection) return

    if (navScrollFrameRef.current) {
      cancelAnimationFrame(navScrollFrameRef.current)
    }

    const startTop = scrollStage.scrollTop
    const endTop = targetSection.offsetTop
    const distance = endTop - startTop
    const startTime = performance.now()

    isProgrammaticScrollRef.current = true

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / NAV_SCROLL_DURATION_MS, 1)
      const easedProgress = 1 - (1 - progress) ** 3

      scrollStage.scrollTop = startTop + distance * easedProgress

      if (progress < 1) {
        navScrollFrameRef.current = requestAnimationFrame(animate)
        return
      }

      scrollStage.scrollTop = endTop
      isProgrammaticScrollRef.current = false
      navScrollFrameRef.current = null
    }

    navScrollFrameRef.current = requestAnimationFrame(animate)
  }

  const handleSelect = (id: SectionId) => {
    setActiveSection(id)

    requestAnimationFrame(() => scrollToSection(id))
  }

  return (
    <div className="app">
      <video
        className="background-video"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src={backgroundVideo} type="video/mp4" />
      </video>

      <div className="scroll-stage" ref={scrollStageRef}>
        {SECTION_ORDER.map((id) => (
          <div
            key={id}
            ref={(el) => {
              sectionRefs.current[id] = el;
            }}
            data-section={id}
            className="section-page"
          >
            <div className="app-panel">
              {renderSection(id, selectedProjectId, setSelectedProjectId)}
            </div>
          </div>
        ))}
      </div>

      {!isMobile && (
        <PersistentAssistant
          visible={isAssistantVisible}
          activeSection={activeSection}
        />
      )}

      <NavBar
        active={activeSection}
        onSelect={handleSelect}
      />
    </div>
  )
}

export default App
