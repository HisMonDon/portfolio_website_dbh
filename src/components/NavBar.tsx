import './NavBar.css'
import { useEffect, useState } from 'react'
export type SectionId = 'about' | 'contact' | 'resume' | 'projects' | 'skills'

interface NavItem {
  id: SectionId
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'about', label: 'About Me' },
  { id: 'projects', label: 'Projects' },
  { id: 'resume', label: 'Resume' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
]

interface NavBarProps {
  active: SectionId
  onSelect: (id: SectionId) => void
}

export default function NavBar({ active, onSelect }: NavBarProps) {
  const [visualActive, setVisualActive] = useState<SectionId>(active)

  useEffect(() => {
    setVisualActive(active)
  }, [active])

  return (
    <nav className="navbar">
      {NAV_ITEMS.map((item, i) => {
        const isActive = visualActive === item.id

        return (
          <div className="navbar-item-wrap" key={item.id}>
            <button
              type="button"
              className={`navbar-item${isActive ? ' active' : ''}`}
              onClick={() => {
                setVisualActive(item.id)
                onSelect(item.id)
              }}
              onMouseEnter={() => setVisualActive(item.id)}
            >
              {isActive && (
                <>
                  <span className="navbar-triangle-layer" aria-hidden="true">
                    <span className="navbar-triangle one" />
                    <span className="navbar-triangle two" />
                    <span className="navbar-triangle three" />
                    <span className="navbar-triangle four" />
                    <span className="navbar-triangle five" />
                    <span className="navbar-triangle six" />
                    <span className="navbar-triangle seven" />
                    <span className="navbar-triangle eight" />
                  </span>
                  <span className="navbar-item-corner tl" />
                  <span className="navbar-item-corner tr" />
                  <span className="navbar-item-corner bl" />
                  <span className="navbar-item-corner br" />
                </>
              )}
              <span className="navbar-item-label">{item.label}</span>
            </button>
            {i < NAV_ITEMS.length - 1 && <span className="navbar-tick" />}
          </div>
        )
      })}
    </nav>
  )

}
