import './NavBar.css'

export type SectionId = 'about' | 'resume' | 'projects' | 'skills' | 'credits'

interface NavItem {
  id: SectionId
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'about', label: 'About Me' },
  { id: 'resume', label: 'Resume' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'credits', label: 'Credits' },
]

interface NavBarProps {
  active: SectionId
  onSelect: (id: SectionId) => void
}

export default function NavBar({ active, onSelect }: NavBarProps) {
  return (
    <nav className="navbar">
      {NAV_ITEMS.map((item, i) => (
        <div className="navbar-item-wrap" key={item.id}>
          <button
            type="button"
            className={`navbar-item${active === item.id ? ' active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            {active === item.id && (
              <>
                <span className="navbar-item-corner tl" />
                <span className="navbar-item-corner br" />
              </>
            )}
            {item.label}
          </button>
          {i < NAV_ITEMS.length - 1 && <span className="navbar-tick" />}
        </div>
      ))}
    </nav>
  )
}
