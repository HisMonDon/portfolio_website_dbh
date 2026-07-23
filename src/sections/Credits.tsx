import './Section.css'
import './Credits.css'

const CREDITS = [
  'Design & development — placeholder name',
  '3D avatar — placeholder credit',
  'Built with React + Vite',
]

export default function Credits() {
  return (
    <div>
      <p className="section-eyebrow">Colophon</p>
      <h1 className="section-title">Credits</h1>
      <ul className="credits-list">
        {CREDITS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
