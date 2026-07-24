import { useState, useEffect, useRef } from 'react'
import NavBar, { type SectionId } from './components/NavBar'
import AvatarSlot from './components/AvatarSlot'
import AboutMe from './sections/AboutMe'
import Resume from './sections/Resume'
import Skills from './sections/Skills'
import Credits from './sections/Credits'
import Projects from './sections/projects/Projects'
import './App.css'
import backgroundVideo from './assets/backgroung_portfolio.mp4'
import { getActiveSectionList, type ActiveSection } from './sections/sectionConfig'

const INITIAL_SECTION: SectionId = 'about'
const NAV_SCROLL_DURATION_MS = 900

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
  const [activeSection, setActiveSection] = useState<ActiveSection>(
    getActiveSectionList(INITIAL_SECTION),
  )

  useEffect(() => {
    const scrollStage = scrollStageRef.current

    if (scrollStage) {
      scrollStage.scrollTop = scrollStage.clientHeight
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
          setActiveSection((current) =>
            current.second === id ? current : getActiveSectionList(id),
          )
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
  }, [activeSection.first, activeSection.second, activeSection.third])

  useEffect(() => {
    return () => {
      if (navScrollFrameRef.current) {
        cancelAnimationFrame(navScrollFrameRef.current)
      }
    }
  }, [])

  const scrollToMiddleSection = () => {
    const scrollStage = scrollStageRef.current

    if (!scrollStage) return

    if (navScrollFrameRef.current) {
      cancelAnimationFrame(navScrollFrameRef.current)
    }

    const startTop = scrollStage.scrollTop
    const endTop = scrollStage.clientHeight
    const distance = endTop - startTop
    const startTime = performance.now()
    const originalSnapType = scrollStage.style.scrollSnapType

    isProgrammaticScrollRef.current = true
    scrollStage.style.scrollSnapType = 'none'

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / NAV_SCROLL_DURATION_MS, 1)
      const easedProgress = 1 - (1 - progress) ** 3

      scrollStage.scrollTop = startTop + distance * easedProgress

      if (progress < 1) {
        navScrollFrameRef.current = requestAnimationFrame(animate)
        return
      }

      scrollStage.scrollTop = endTop
      scrollStage.style.scrollSnapType = originalSnapType
      isProgrammaticScrollRef.current = false
      navScrollFrameRef.current = null
    }

    navScrollFrameRef.current = requestAnimationFrame(animate)
  }

  const handleSelect = (id: SectionId) => {
    setActiveSection(getActiveSectionList(id))

    requestAnimationFrame(scrollToMiddleSection)
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
        {[activeSection.first, activeSection.second, activeSection.third].map((id) => (
          <div
            key={id}
            ref={(el) => {
              sectionRefs.current[id] = el;
            }}
            data-section={id}
            className="section-page"
          >
            <div className="app-panel">{renderSection(id)}</div>
          </div>
        ))}
      </div>

      {activeSection.second !== 'projects' && <AvatarSlot />}

      <NavBar
        active={activeSection.second}
        onSelect={handleSelect}
      />
    </div>
  )
}

export default App
