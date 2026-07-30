import { useState, useEffect, useRef } from 'react'
import NavBar, { type SectionId } from './components/NavBar'
import PersistentAssistant from './components/PersistentAssistant'
import Contact from './sections/Contact'
import Resume from './sections/Resume'
import Skills from './sections/Skills'
import Projects from './sections/projects/Projects'
import './App.css'
import backgroundVideo from './assets/backgroung_portfolio.mp4'
import { SECTION_ORDER } from './sections/sectionConfig'
import { useIsMobile } from './hooks/useIsMobile'
import { useInterfaceSounds } from './hooks/playSound'
import LoadingScreen from "./LoadingScreen";
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
    case 'contact':
      return <Contact />
    case 'resume':
      return <Resume />
    case 'projects':
      return <Projects selectedId={selectedProjectId} onSelect={onSelectProject} />
    case 'skills':
      return <Skills />
    default:
      return null
  }
}
//=========================================================================
//STARTS HERE
export default function App() {
  const scrollStageRef = useRef<HTMLDivElement | null>(null)
  const navScrollEndTimeoutRef = useRef<number | null>(null)
  const isProgrammaticScrollRef = useRef(false)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    about: null,
    projects: null,
    resume: null,
    skills: null,
    contact: null,
  })
  const [activeSection, setActiveSection] = useState<SectionId>(INITIAL_SECTION)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const isMobile = useIsMobile()
  const isAssistantVisible = activeSection !== 'projects'
  const { handleInterfaceHover, handleInterfaceSelect } = useInterfaceSounds(isMuted)
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const handleLoadingFinish = (): void => {
    setIsLoading(false);
  };
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

    const cancelProgrammaticScroll = (event?: Event) => {
      const target = event?.target

      if (
        event?.type === 'pointerdown'
        && target instanceof Element
        && target.closest('a, button, input, select, textarea, [role="button"]')
      ) {
        return
      }

      if (navScrollEndTimeoutRef.current !== null) {
        window.clearTimeout(navScrollEndTimeoutRef.current)
        navScrollEndTimeoutRef.current = null
      }

      if (scrollStage && isProgrammaticScrollRef.current) {
        scrollStage.scrollTo({ top: scrollStage.scrollTop, behavior: 'auto' })
      }

      isProgrammaticScrollRef.current = false
      scrollStage?.classList.remove('is-programmatic-scrolling')
    }

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

    if (navScrollEndTimeoutRef.current !== null) {
      window.clearTimeout(navScrollEndTimeoutRef.current)
    }

    const endTop = targetSection.offsetTop

    isProgrammaticScrollRef.current = true
    scrollStage.classList.add('is-programmatic-scrolling')
    scrollStage.scrollTo({ top: endTop, behavior: 'smooth' })

    navScrollEndTimeoutRef.current = window.setTimeout(() => {
      scrollStage.scrollTop = endTop
      isProgrammaticScrollRef.current = false
      navScrollEndTimeoutRef.current = null
      scrollStage.classList.remove('is-programmatic-scrolling')
    }, NAV_SCROLL_DURATION_MS)
  }

  const handleSelect = (id: SectionId) => {
    scrollToSection(id)
    setActiveSection(id)
  }
  {/*LOADING SCREEN */ }
  if (isLoading) {
    return <LoadingScreen onFinish={handleLoadingFinish} />
  }
  //RETURN
  return (
    <div
      className="app"
      onClick={handleInterfaceSelect}
      onPointerOver={handleInterfaceHover}
    >

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
            className={`section-page${id === 'projects' && selectedProjectId ? ' is-project-detail' : ''}`}
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
          isMuted={isMuted}
          onMutedChange={setIsMuted}
        />
      )}

      <p
        className={`app-portfolio-name${activeSection === 'about' ? ' is-visible' : ''}`}
        aria-hidden={activeSection !== 'about'}
      >
        Chenyu Portfolio
      </p>

      <p
        className={`app-inspired-by${activeSection === 'about' ? ' is-visible' : ''}`}
        aria-hidden={activeSection !== 'about'}
      >
        Interface inspired by <em>Detroit: Become Human</em>
      </p>

      <NavBar
        active={activeSection}
        onSelect={handleSelect}
      />
    </div>
  )
}

//export default App
